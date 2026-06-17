// common/adapters/redis.adapter.ts
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { INestApplicationContext, Logger } from '@nestjs/common';

/**
 * 다중 인스턴스 환경에서 Socket.IO 이벤트를 공유하기 위한 Redis 기반 어댑터입니다.
 * Pub/Sub 클라이언트로 서버 간 브로드캐스트를 중계합니다.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;
  private logger = new Logger('RedisIoAdapter');

  constructor(
    appOrHttpServer: INestApplicationContext | object,
    private readonly redisUrl: string,
  ) {
    super(appOrHttpServer);
  }

  /**
   * Redis Pub/Sub 클라이언트 한 쌍을 생성해 Socket.IO 어댑터를 구성합니다.
   * @returns {void}
   */
  connectToRedis(): void {
    // Pub/Sub은 동일 커넥션을 공유할 수 없어, 구독 전용 클라이언트를 duplicate로 분리한다.
    const pubClient = new Redis(this.redisUrl);
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) =>
      this.logger.error('Redis Pub Client Error', err),
    );
    subClient.on('error', (err) =>
      this.logger.error('Redis Sub Client Error', err),
    );

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Redis에 소켓 어댑터가 성공적으로 연결되었습니다!');
  }

  /**
   * Socket.IO 서버를 생성하고 Redis 어댑터를 부착해 반환합니다.
   * @param {number} port - 소켓 서버 포트
   * @param {ServerOptions} [options] - Socket.IO 서버 옵션
   * @returns {Server} Redis 어댑터가 적용된 Socket.IO 서버
   */
  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    server.adapter(this.adapterConstructor);
    return server;
  }
}
