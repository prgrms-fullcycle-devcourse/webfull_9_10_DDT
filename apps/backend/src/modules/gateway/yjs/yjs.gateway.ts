import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { IncomingMessage } from 'http';
import { RedisService } from '../../../common/redis/redis.service';
import { setupYjsWSConnection } from './yjs.utils';
import { Duplex } from 'stream';
import { JwtService } from '@nestjs/jwt';

interface RoomState {
  phase?: string;
  members?: Record<string, unknown>;
}

@Injectable()
export class YjsGateway implements OnModuleDestroy {
  private wss: WebSocketServer | null = null;
  private readonly logger: Logger = new Logger(YjsGateway.name);
  private clientRoomMap = new Map<WebSocket, string>();

  constructor(
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
  ) {}

  init(httpServer: Server) {
    this.wss = new WebSocketServer({
      noServer: true,
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      void this.handleConnection(ws, req);
    });

    httpServer.on(
      'upgrade',
      (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        const url = new URL(request.url ?? '', 'http://localhost');

        if (url.pathname === '/yjs') {
          this.wss!.handleUpgrade(request, socket, head, (ws) => {
            this.wss!.emit('connection', ws, request);
          });
        }
      },
    );
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

    const url = new URL(req.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token')?.replace(/\/$/, '') ?? null;
    if (!token) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    let payload: { sub: string; role: string };
    try {
      payload = this.jwtService.verify<{ sub: string; role: string }>(token);
    } catch {
      ws.close(1008, 'Invalid token');
      this.logger.error('Invalid token');
      return;
    }

    const raw = await this.redis.instance.get(`room:state:${roomCode}`);

    if (!raw) {
      this.logger.warn(`방 정보를 찾을 수 없음: ${roomCode}`);
      ws.close(1008, 'Room not found');
      return;
    }

    const state = JSON.parse(raw) as RoomState;

    const identifier = payload.sub;
    if (!state.members?.[identifier]) {
      ws.close(1008, 'Forbidden');
      return;
    }

    if (
      state.phase === 'timer' ||
      state.phase === 'result' ||
      state.phase === 'closed'
    ) {
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
