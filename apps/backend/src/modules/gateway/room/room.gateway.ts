import { Logger, forwardRef, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { RoomService } from '../../room/room.service';
import { EscapeService } from '../../escape/escape.service';

/** Socket.IO 클라이언트에 저장되는 커스텀 데이터 */
interface SocketData {
  roomCode: string;
  userId: string;
  role: string;
}

type RoomSocket = Socket<
  DefaultEventsMap, // ClientToServer 이벤트
  DefaultEventsMap, // ServerToClient 이벤트
  DefaultEventsMap, // InterServer 이벤트
  SocketData
>;

interface JwtPayload {
  sub: string;
  role: string;
}

/**
 * 방 실시간 통신을 담당하는 Socket.IO 게이트웨이.
 * 멤버 연결/해제, 서명, 강퇴, 계약서 편집, 이탈 감지, heartbeat 등
 * 방 내 모든 실시간 이벤트를 처리합니다.
 */
@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'https://webfull-9-10-ddt-frontend.vercel.app',
    ],
    credentials: true,
  },
})
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => RoomService))
    private readonly roomService: RoomService,
    private readonly escapeService: EscapeService,
  ) {}
  @WebSocketServer()
  server!: Server<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    SocketData
  >;

  private cleanupTimers = new Map<string, NodeJS.Timeout>();
  private readonly logger = new Logger(RoomGateway.name);

  /**
   * 클라이언트 연결 시 실행됩니다.
   * JWT 검증 → 방 상태 확인 → 멤버 검증 → 중복 연결 처리 → 방 입장 순으로 진행합니다.
   * timer 페이즈에서 재접속한 멤버에게는 세션 정보를 재전송합니다.
   *
   * @param client - 연결된 Socket.IO 클라이언트
   */
  async handleConnection(client: RoomSocket): Promise<void> {
    const token =
      (client.handshake.auth.token as string) ??
      (client.handshake.query.token as string) ??
      client.handshake.headers.authorization?.replace('Bearer ', '');
    const roomCode = client.handshake.query.roomCode as string;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify(token) as unknown as JwtPayload;
      client.data.userId = payload.sub;
      client.data.role = payload.role;
    } catch {
      client.disconnect();
      return;
    }

    if (!roomCode) {
      client.disconnect();
      return;
    }

    const roomState = await this.roomService.getRoomState(roomCode);

    if (!roomState) {
      client.disconnect();
      return;
    }

    if (roomState.phase === 'timer' && !roomState.members[client.data.userId]) {
      client.emit('force-disconnect', { reason: 'room-timer' });
      setTimeout(() => client.disconnect(), 100);
      return;
    }

    if (['closed', 'result'].includes(roomState.phase)) {
      client.emit('force-disconnect', { reason: 'room-closed' });
      setTimeout(() => client.disconnect(), 100);
      return;
    }

    const userId = client.data.role === 'user' ? client.data.userId : null;
    const guestToken = client.data.role === 'guest' ? client.data.userId : null;

    const isValid = await this.roomService.isMember(
      roomCode,
      userId,
      guestToken,
    );

    if (!isValid) {
      client.emit('force-disconnect', { reason: 'not-a-member' });
      setTimeout(() => client.disconnect(), 100);
      return;
    }

    const existingSocketId = roomState.members[client.data.userId]?.socketId;

    if (existingSocketId) {
      this.server
        .to(existingSocketId)
        .emit('force-disconnect', { reason: 'duplicate-connection' });

      setTimeout(() => {
        void this.server
          .in(roomCode)
          .fetchSockets()
          .then((sockets) => {
            const duplicate = sockets.find((s) => s.id === existingSocketId);
            duplicate?.disconnect();
          });
      }, 100);
    }

    if (this.cleanupTimers.has(roomCode)) {
      clearTimeout(this.cleanupTimers.get(roomCode));
      this.cleanupTimers.delete(roomCode);
    }

    client.data.roomCode = roomCode;
    await client.join(roomCode);
    await this.updateMemberConnection(client, true);
    this.logger.log(`클라이언트 연결됨: ${client.id} 방: ${roomCode}`);

    const updated = await this.roomService.transitionToContract(roomCode);

    client.emit('room:state', updated ?? roomState);

    client.to(roomCode).emit('member:joined', {
      userId: client.data.userId,
      ...roomState.members[client.data.userId],
    });

    if (roomState.phase === 'timer') {
      if (userId) {
        await this.escapeService.logEscapeEnd(roomCode, userId);
      }
      await this.emitSessionStartedIfTimer(client, roomCode);
    }
  }

  /**
   * 클라이언트 연결 해제 시 실행됩니다.
   * heartbeat 정리 → 연결 상태 해제 → 이탈 로그 시작(timer 중이면) → 방 정리 타이머 등록.
   * 모든 멤버가 나가면 10초 후 방을 자동 폭파합니다.
   *
   * @param client - 연결 해제된 Socket.IO 클라이언트
   */
  async handleDisconnect(client: RoomSocket): Promise<void> {
    this.logger.log(`클라이언트 연결 끊김: ${client.id}`);

    const { roomCode, userId } = client.data;

    if (!roomCode || !userId) {
      return;
    }

    await this.escapeService.clearHeartbeat(roomCode, userId);

    const roomState = await this.roomService.getRoomState(roomCode);

    if (roomState?.members[userId]?.socketId === client.id) {
      await this.roomService.setConnected(roomCode, userId, false);

      if (roomState.phase === 'timer') {
        if (!roomState.members[userId]?.gaveUpAt) {
          await this.escapeService.logEscapeStart(roomCode, userId);
        }
      }

      client.to(roomCode).emit('member:left', { userId });

      const onlineMembersCount =
        await this.roomService.countConnectedMembers(roomCode);

      if (!onlineMembersCount) {
        if (this.cleanupTimers.has(roomCode)) {
          clearTimeout(this.cleanupTimers.get(roomCode));
        }
        const timer = setTimeout(() => {
          void this.handleRoomCleanup(roomCode).finally(() => {
            this.cleanupTimers.delete(roomCode);
          });
        }, 10000);
        this.cleanupTimers.set(roomCode, timer);
      } else {
        if (this.cleanupTimers.has(roomCode)) {
          clearTimeout(this.cleanupTimers.get(roomCode));
          this.cleanupTimers.delete(roomCode);
        }
      }
    }
  }

  /**
   * 프론트엔드 연결 확인용 ping/pong 핸들러.
   *
   * @param data - 클라이언트에서 보낸 데이터
   * @returns pong 응답
   */
  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: unknown): { event: string; data: string } {
    this.logger.log(`프론트에서 온 메시지: ${String(data)}`);
    return { event: 'pong', data: '백엔드에서 답장 보냄!' };
  }

  /**
   * 멤버의 소켓 연결 상태를 Redis에 반영합니다.
   *
   * @param client - Socket.IO 클라이언트
   * @param connected - 연결 여부
   */
  private async updateMemberConnection(
    client: RoomSocket,
    connected: boolean,
  ): Promise<void> {
    const { roomCode, userId } = client.data;

    await this.roomService.setConnected(
      roomCode,
      userId,
      connected,
      connected ? client.id : undefined,
    );
  }

  /**
   * 모든 멤버가 나간 방의 정리를 처리합니다.
   * timer 중이면 활성 멤버 유무를 확인하고, result 페이즈는 보호합니다.
   * 정리 조건 충족 시 room:closed 이벤트 → deleteRoom → 소켓 전체 해제.
   *
   * @param roomCode - 정리할 방 코드
   */
  private async handleRoomCleanup(roomCode: string): Promise<void> {
    const roomState = await this.roomService.getRoomState(roomCode);

    if (roomState && ['timer', 'result'].includes(roomState.phase)) {
      if (roomState.phase === 'result') {
        this.logger.log(
          `[보호됨] 결과 진행 중이므로 방(${roomCode})을 폭파하지 않습니다.`,
        );
        return;
      }

      const activeCount =
        await this.roomService.countActiveMembersInRoom(roomCode);

      if (activeCount > 0) {
        this.logger.log(
          `[보호됨] 활성 멤버가 있으므로 방(${roomCode})을 폭파하지 않습니다.`,
        );
        return;
      }
    }

    const currentCount = await this.roomService.countConnectedMembers(roomCode);
    if (currentCount === 0) {
      this.server.to(roomCode).emit('room:closed', {
        reason: '회원이 나가서 방이 종료되었습니다.',
      });
      await this.roomService.deleteRoom(roomCode);

      setTimeout(() => {
        this.server.in(roomCode).disconnectSockets();
      }, 100);
    }
  }

  /**
   * 멤버 서명 토글 이벤트 핸들러.
   * 서명 상태를 변경하고 전체 멤버에게 브로드캐스트합니다.
   *
   * @param client - 서명하는 클라이언트
   * @param body - { signed: 서명 여부 }
   */
  @SubscribeMessage('member:sign')
  async handleSign(
    @ConnectedSocket() client: RoomSocket,
    @MessageBody() body: { signed: boolean },
  ) {
    const { roomCode, userId } = client.data;

    const result = await this.roomService.setSigned(
      roomCode,
      userId,
      body.signed,
    );

    if (!result) {
      return;
    }

    this.server.to(roomCode).emit('sign:updated', {
      userId,
      signed: body.signed,
      signedCount: result.signedCount,
      totalCount: result.totalCount,
      allSigned: result.allSigned,
    });
  }

  /**
   * 멤버 강퇴 이벤트 핸들러. (방장 전용)
   * 대상 멤버를 DB/Redis에서 제거하고 소켓 연결을 해제합니다.
   *
   * @param client - 방장 클라이언트
   * @param body - { targetId: 강퇴 대상 ID }
   */
  @SubscribeMessage('member:kick')
  async handleKick(
    @ConnectedSocket() client: RoomSocket,
    @MessageBody() body: { targetId: string },
  ) {
    const { roomCode, userId } = client.data;

    if (userId === body.targetId) return;

    const roomState = await this.roomService.getRoomState(roomCode);

    if (!roomState) {
      return;
    }

    const isHost = roomState.members[userId]?.isHost;

    if (!isHost) {
      return;
    }

    await this.roomService.kickMember(roomCode, body.targetId);

    const sockets = await this.server.in(roomCode).fetchSockets();
    const targetSocket = sockets.find((s) => s.data.userId === body.targetId);

    if (targetSocket) {
      targetSocket.emit('kicked');
      setTimeout(() => targetSocket.disconnect(), 100);

      this.server
        .to(roomCode)
        .emit('member:kicked', { targetId: body.targetId });
    }
  }

  /**
   * 계약서(각서) 편집 이벤트 핸들러.
   * 계약서가 수정되면 전체 멤버의 서명을 초기화합니다.
   *
   * @param client - 편집한 클라이언트
   */
  @SubscribeMessage('contract:edited')
  async handleContractEdited(@ConnectedSocket() client: RoomSocket) {
    const { userId, roomCode } = client.data;

    const result = await this.roomService.resetAllSigns(roomCode);

    if (!result) {
      return;
    }

    this.server.to(roomCode).emit('sign:reset', {
      userId,
    });
  }

  /**
   * 특정 멤버의 편집 권한 변경 이벤트 핸들러. (방장 전용)
   *
   * @param client - 방장 클라이언트
   * @param body - { targetId: 대상 ID, canEdit: 편집 허용 여부 }
   */
  @SubscribeMessage('edit:member')
  async handleEditMember(
    @ConnectedSocket() client: RoomSocket,
    @MessageBody() body: { targetId: string; canEdit: boolean },
  ) {
    const { roomCode, userId } = client.data;
    const ok = await this.roomService.setMemberEdit(
      roomCode,
      userId,
      body.targetId,
      body.canEdit,
    );

    if (!ok) {
      return;
    }

    this.server
      .to(roomCode)
      .emit('edit:updated', { targetId: body.targetId, canEdit: body.canEdit });
  }

  /**
   * 전체 멤버의 편집 권한 일괄 변경 이벤트 핸들러. (방장 전용)
   *
   * @param client - 방장 클라이언트
   * @param body - { canEdit: 편집 허용 여부 }
   */
  @SubscribeMessage('edit:all')
  async handleEditAll(
    @ConnectedSocket() client: RoomSocket,
    @MessageBody() body: { canEdit: boolean },
  ) {
    const { roomCode, userId } = client.data;

    const ok = await this.roomService.setAllEdit(
      roomCode,
      userId,
      body.canEdit,
    );

    if (!ok) {
      return;
    }
    this.server
      .to(roomCode)
      .emit('edit:all-updated', { canEdit: body.canEdit });
  }

  /**
   * heartbeat 이벤트 핸들러.
   * 클라이언트가 주기적으로 전송하며, Redis에 마지막 활동 시각을 기록합니다.
   * 이탈 감지 서비스에서 heartbeat 만료를 기준으로 이탈을 판정합니다.
   *
   * @param client - heartbeat을 보낸 클라이언트
   */
  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: RoomSocket) {
    const { roomCode, userId } = client.data;
    await this.escapeService.updateHeartbeat(roomCode, userId);
  }

  /**
   * 화면 이탈 시작 이벤트 핸들러.
   * 클라이언트의 visibilitychange(hidden) 또는 blur 시 호출됩니다.
   *
   * @param client - 이탈한 클라이언트
   */
  @SubscribeMessage('escape:start')
  async handleEscapeStart(@ConnectedSocket() client: RoomSocket) {
    const { roomCode, userId } = client.data;
    await this.escapeService.logEscapeStart(roomCode, userId);
  }

  /**
   * 화면 이탈 종료 이벤트 핸들러.
   * 클라이언트가 앱으로 복귀하면 호출됩니다.
   *
   * @param client - 복귀한 클라이언트
   */
  @SubscribeMessage('escape:end')
  async handleEscapeEnd(@ConnectedSocket() client: RoomSocket) {
    const { roomCode, userId } = client.data;
    await this.escapeService.logEscapeEnd(roomCode, userId);
  }

  /**
   * timer 페이즈에서 재접속한 클라이언트에게 세션 시작 정보를 전송합니다.
   * 시작 시각, 타이머 설정, 서버 시간을 포함하여 클라이언트가 타이머를 복원할 수 있게 합니다.
   *
   * @param client - 재접속한 클라이언트
   * @param roomCode - 방 코드
   */
  private async emitSessionStartedIfTimer(
    client: RoomSocket,
    roomCode: string,
  ) {
    const room = await this.roomService.findRoomWithTemplate(roomCode);

    if (!room?.startedAt || !room.template) {
      this.logger.warn(`timer phase인데 정보 부족: ${roomCode}`);
      return;
    }

    client.emit('session:started', {
      startedAt: room.startedAt,
      focusMin: room.template.focusMin,
      breakMin: room.template.breakMin,
      totalRounds: room.template.rounds,
      serverTime: new Date(),
    });
  }
}
