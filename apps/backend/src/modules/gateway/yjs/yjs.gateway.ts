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

/**
 * Yjs 실시간 협업 편집을 위한 WebSocket 게이트웨이.
 * 계약서(각서) 공동 편집 시 y-websocket 프로토콜로 Y.Doc을 동기화합니다.
 * HTTP 서버의 /yjs 경로로 들어오는 WebSocket upgrade 요청을 처리합니다.
 */
@Injectable()
export class YjsGateway implements OnModuleDestroy {
  private wss: WebSocketServer | null = null;
  private readonly logger: Logger = new Logger(YjsGateway.name);
  private clientRoomMap = new Map<WebSocket, string>();

  constructor(
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * HTTP 서버에 WebSocket 업그레이드 핸들러를 등록합니다.
   * /yjs 경로의 upgrade 요청만 y-websocket으로 라우팅합니다.
   * NestJS 앱 부트스트랩 시 main.ts에서 호출됩니다.
   *
   * @param httpServer - NestJS HTTP 서버 인스턴스
   */
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

  /**
   * WebSocket 연결을 처리합니다.
   * 토큰 검증 → Redis 방 상태 확인 → 멤버 여부 확인 → 페이즈 확인 순으로 검증 후
   * y-websocket 연결을 수립합니다.
   * timer/result/closed 페이즈에서는 연결을 거부합니다 (계약서 편집 불필요).
   *
   * @param ws - WebSocket 클라이언트
   * @param req - HTTP upgrade 요청 (roomCode, token 쿼리 파라미터 포함)
   */
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

  /**
   * 특정 방에 연결된 모든 Yjs WebSocket 클라이언트를 종료하고 Y.Doc을 정리합니다.
   * 타이머 시작 시 또는 room.closed 이벤트 수신 시 호출됩니다.
   *
   * @param roomCode - 정리할 방 코드
   */
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

  /**
   * 모듈 종료 시 WebSocket 서버를 정리합니다.
   */
  onModuleDestroy() {
    this.wss?.close();
    this.wss = null;
  }

  /**
   * HTTP 요청 URL에서 roomCode 쿼리 파라미터를 추출합니다.
   * 끝에 붙는 슬래시(/)를 제거하여 반환합니다.
   *
   * @param req - HTTP 요청
   * @returns 방 코드 문자열 (없으면 빈 문자열)
   */
  private getRoomCode(req: IncomingMessage): string {
    const url = new URL(req.url ?? '', 'http://localhost');
    const roomCode = url.searchParams.get('roomCode');
    // 끝에 슬래시 제거
    return roomCode ? roomCode.replace(/\/$/, '') : '';
  }
}
