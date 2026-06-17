import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * 애플리케이션 전역에서 공유하는 단일 Redis 클라이언트를 관리하는 서비스입니다.
 * 다른 모듈은 instance getter로 ioredis 클라이언트에 접근합니다.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private readonly configService: ConfigService) {
    // REDIS_URL 미설정 시 즉시 부팅 실패시키기 위해 getOrThrow 사용
    this.client = new Redis(this.configService.getOrThrow<string>('REDIS_URL'));
  }

  /**
   * 공유 중인 ioredis 클라이언트 인스턴스를 반환합니다.
   * @returns {Redis} ioredis 클라이언트
   */
  get instance(): Redis {
    return this.client;
  }

  /**
   * 모듈 기동 시 Redis 연결 에러 핸들러를 등록합니다.
   * @returns {void}
   */
  onModuleInit(): void {
    this.client.on('error', (err) => {
      console.error('Redis Client Error', err);
    });
  }

  /**
   * 모듈 종료 시 Redis 연결을 정상 종료합니다.
   * @returns {void}
   */
  onModuleDestroy(): void {
    void this.client.quit();
  }
}
