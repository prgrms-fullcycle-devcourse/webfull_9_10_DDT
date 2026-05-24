import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis(this.configService.getOrThrow<string>('REDIS_URL'));
  }

  get instance(): Redis {
    return this.client;
  }

  onModuleInit(): void {
    this.client.on('error', (err) => {
      console.error('Redis Client Error', err);
    });
  }

  onModuleDestroy(): void {
    void this.client.quit();
  }
}
