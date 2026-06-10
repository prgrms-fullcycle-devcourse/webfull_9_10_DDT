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

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: unknown): { event: string; data: string } {
    this.logger.log(`프론트에서 온 메시지: ${String(data)}`);
    return { event: 'pong', data: '백엔드에서 답장 보냄!' };
  }

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

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: RoomSocket) {
    const { roomCode, userId } = client.data;
    await this.escapeService.updateHeartbeat(roomCode, userId);
  }

  @SubscribeMessage('escape:start')
  async handleEscapeStart(@ConnectedSocket() client: RoomSocket) {
    const { roomCode, userId } = client.data;
    await this.escapeService.logEscapeStart(roomCode, userId);
  }

  @SubscribeMessage('escape:end')
  async handleEscapeEnd(@ConnectedSocket() client: RoomSocket) {
    const { roomCode, userId } = client.data;
    await this.escapeService.logEscapeEnd(roomCode, userId);
  }

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
