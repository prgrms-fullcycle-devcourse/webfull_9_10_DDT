import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { IncomingMessage } from 'http';
import { RedisService } from '../../../common/redis/redis.service';
import { setupYjsWSConnection } from './yjs.utils';

interface RoomState {
  phase: string;
}

@Injectable()
export class YjsGateway implements OnModuleDestroy {
  private wss: WebSocketServer | null = null;
  private readonly logger: Logger = new Logger(YjsGateway.name);
  private clientRoomMap = new Map<WebSocket, string>();

  constructor(private readonly redis: RedisService) {}

  init(httpServer: Server) {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/yjs',
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      void this.handleConnection(ws, req);
    });
  }

  private async handleConnection(
    ws: WebSocket,
    req: IncomingMessage,
  ): Promise<void> {
    const roomCode = this.getRoomCode(req);
    this.logger.log(`연결 시도 - Room: ${roomCode}`);

    if (!roomCode) {
      ws.close();
      return;
    }

    const raw = await this.redis.instance.get(`room:state:${roomCode}`);
    const state = raw ? (JSON.parse(raw) as RoomState) : null;

    if (!raw) {
      this.logger.warn(`방 정보를 찾을 수 없음: ${roomCode}`);
      ws.close(1008, 'Room not found');
      return;
    }

    if (state?.phase === 'timer') {
      this.logger.log(`연결 종료(타이머 페이즈): ${roomCode}`);
      ws.close();
      return;
    }

    this.clientRoomMap.set(ws, roomCode);

    ws.on('close', () => {
      this.clientRoomMap.delete(ws);
    });

    setupYjsWSConnection(ws, req, { docName: roomCode });
  }

  destroyRoom(roomCode: string): void {
    if (!this.wss) return;

    const targets: WebSocket[] = [];
    this.wss.clients.forEach((client: WebSocket) => {
      if (this.clientRoomMap.get(client) === roomCode) {
        targets.push(client);
      }
    });

    targets.forEach((client) => {
      client.close();
      this.clientRoomMap.delete(client);
    });
  }

  onModuleDestroy() {
    this.wss?.close();
    this.wss = null;
  }

  private getRoomCode(req: IncomingMessage): string {
    const url = new URL(req.url ?? '', 'http://localhost');
    const roomCode = url.searchParams.get('roomCode');
    // 끝에 슬래시 제거
    return roomCode ? roomCode.replace(/\/$/, '') : '';
  }
}
