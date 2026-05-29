import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { EscapeService } from './escape.service';

@WebSocketGateway({ cors: true })
export class EscapeGateway {
  constructor(private readonly escapeService: EscapeService) {}

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string; identifier: string },
  ) {
    await this.escapeService.updateHeartbeat(
      payload.roomCode,
      payload.identifier,
    );
  }

  @SubscribeMessage('escape:start')
  async handleEscapeStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string; identifier: string },
  ) {
    await this.escapeService.logEscapeStart(
      payload.roomCode,
      payload.identifier,
    );
  }

  @SubscribeMessage('escape:end')
  async handleEscapeEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string; identifier: string },
  ) {
    await this.escapeService.logEscapeEnd(payload.roomCode, payload.identifier);
  }
}
