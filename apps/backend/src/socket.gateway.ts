// apps/backend/src/socket.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

// 프론트엔드에서 오는 요청을 허용합니다 (CORS)
@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' } })
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private logger = new Logger('SocketGateway');

  // 누군가 접속했을 때
  handleConnection(client: Socket) {
    this.logger.log(`😎 클라이언트 연결됨: ${client.id}`);
    client.emit('welcome', { message: 'DDT 서버에 오신 것을 환영합니다!' });
  }

  // 누군가 나갔을 때
  handleDisconnect(client: Socket) {
    this.logger.log(`👋 클라이언트 연결 끊김: ${client.id}`);
  }

  // 프론트에서 'ping' 이벤트를 보냈을 때 'pong'으로 답장하기
  @SubscribeMessage('ping')
  handlePing(client: Socket, data: any) {
    this.logger.log(`프론트에서 온 메시지: ${data}`);
    return { event: 'pong', data: '백엔드에서 답장 보냄!' };
  }
}