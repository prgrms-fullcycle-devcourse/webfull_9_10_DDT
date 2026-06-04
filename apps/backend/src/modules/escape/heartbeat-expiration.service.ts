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

  async onModuleInit() {
    try {
      await this.redisService.instance.config(
        'SET',
        'notify-keyspace-events',
        'Ex',
      );
      this.logger.log('Redis keyspace notification 활성화 (런타임)');
    } catch (error) {
      this.logger.warn(
        'CONFIG SET 실패 — 외부 설정 가정 (redis.conf 또는 파라미터 그룹)',
        error instanceof Error ? error.message : error,
      );
    }

    this.subscriber = this.redisService.instance.duplicate();

    await this.subscriber.psubscribe('__keyevent@0__:expired');

    this.subscriber.on('pmessage', (_pattern, _channel, key) => {
      void this.handleExpiredKey(key).catch((error) => {
        this.logger.error(`만료 키 처리 실패: ${key}`, error);
      });
    });
    this.logger.log('Heartbeat 만료 구독 시작');
  }

  async onModuleDestroy() {
    if (this.subscriber) {
      await this.subscriber.quit();
    }
  }

  private async handleExpiredKey(key: string) {
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
