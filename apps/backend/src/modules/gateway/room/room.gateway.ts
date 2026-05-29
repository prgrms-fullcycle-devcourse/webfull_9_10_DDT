import { Logger } from '@nestjs/common';
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
    private readonly roomService: RoomService,
    private readonly escapeService: EscapeService,
  ) {}
  @WebSocketServer()
  server!: Server;

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

    const existingSocketId = roomState.members[client.data.userId]?.socketId;

    if (existingSocketId) {
      const sockets = await this.server.in(roomCode).fetchSockets();
      const duplicate = sockets.find((s) => s.id === existingSocketId);

      if (duplicate) {
        duplicate.emit('force-disconnect', { reason: 'duplicate-connection' });
        duplicate.disconnect();
      }
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

    const { nickname, profileImage, isHost } =
      roomState.members[client.data.userId];

    client.emit('room:state', updated ?? roomState);

    client.to(roomCode).emit('member:joined', {
      userId: client.data.userId,
      nickname,
      profileImage,
      isHost,
    });
  }

  async handleDisconnect(client: RoomSocket): Promise<void> {
    this.logger.log(`클라이언트 연결 끊김: ${client.id}`);

    const { roomCode, userId } = client.data;

    if (!roomCode || !userId) {
      return;
    }

    const roomState = await this.roomService.getRoomState(roomCode);

    if (roomState?.members[userId]?.socketId === client.id) {
      await this.roomService.setConnected(roomCode, userId, false);

      if (roomState.phase === 'timer') {
        await this.escapeService.logEscapeStart(roomCode, userId);
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
    const currentCount = await this.roomService.countConnectedMembers(roomCode);
    if (currentCount === 0) {
      await this.roomService.deleteRoom(roomCode);
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
    const targetSocket = sockets.find(
      (s) => (s.data as RoomSocket).data.userId === body.targetId,
    );

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
}
