import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from '../../common/redis/redis.service';
import { EscapeService } from './escape.service';

@Injectable()
export class HeartBeatExpirationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(HeartBeatExpirationService.name);
  private subscriber: Redis | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly escapeService: EscapeService,
  ) {}

  /**
   * 모듈 기동 시 Redis Keyspace 만료 알림을 켜고, heartbeat 만료 이벤트 구독을 시작합니다.
   * @returns {Promise<void>}
   */
  async onModuleInit() {
    try {
      await this.redisService.instance.config(
        'SET',
        'notify-keyspace-events',
        'Ex',
      );
      this.logger.log('Redis keyspace notification 활성화 (런타임)');
    } catch (error) {
      // 매니지드 Redis는 런타임 CONFIG SET이 막혀있을 수 있어, 실패해도 외부 설정을 가정하고 진행
      this.logger.warn(
        'CONFIG SET 실패 — 외부 설정 가정 (redis.conf 또는 파라미터 그룹)',
        error instanceof Error ? error.message : error,
      );
    }

    // 구독 전용 커넥션을 분리(duplicate)해야 일반 명령용 커넥션과 충돌하지 않는다.
    this.subscriber = this.redisService.instance.duplicate();

    await this.subscriber.psubscribe('__keyevent@0__:expired');

    this.subscriber.on('pmessage', (_pattern, _channel, key) => {
      void this.handleExpiredKey(key).catch((error) => {
        this.logger.error(`만료 키 처리 실패: ${key}`, error);
      });
    });
    this.logger.log('Heartbeat 만료 구독 시작');
  }

  /**
   * 모듈 종료 시 구독 전용 Redis 커넥션을 정리합니다.
   * @returns {Promise<void>}
   */
  async onModuleDestroy() {
    if (this.subscriber) {
      await this.subscriber.quit();
    }
  }

  /**
   * 만료된 키가 heartbeat 키면 해당 멤버의 이탈 시작 처리를 트리거합니다.
   * @param {string} key - 만료 이벤트로 전달된 Redis 키
   * @returns {Promise<void>}
   */
  private async handleExpiredKey(key: string) {
    // heartbeat:{roomCode}:{identifier} 형태만 처리하고, 그 외 만료 키는 무시
    if (!key.startsWith('heartbeat:')) {
      return;
    }

    const parts = key.split(':');
    if (parts.length !== 3) {
      return;
    }

    const [, roomCode, identifier] = parts;

    this.logger.log(`heartbeat 만료 감지: ${roomCode} / ${identifier}`);

    await this.escapeService.logEscapeStart(roomCode, identifier);
  }
}
