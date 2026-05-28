import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

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
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RoomGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log(`클라이언트 연결됨: ${client.id}`);
    client.emit('welcome', { message: 'DDT 서버에 오신 것을 환영합니다!' });
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`클라이언트 연결 끊김: ${client.id}`);
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: unknown): { event: string; data: string } {
    this.logger.log(`프론트에서 온 메시지: ${String(data)}`);
    return { event: 'pong', data: '백엔드에서 답장 보냄!' };
  }

  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ) {
    await client.join(body.roomId);
    //client.data.roomId = body.roomId; // 이 줄 추가
    client.to(body.roomId).emit('room:user-joined', { socketId: client.id });
    return { ok: true, roomId: body.roomId };
  }
}
