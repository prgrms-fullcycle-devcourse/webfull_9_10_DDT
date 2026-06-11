import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RoomModule } from './modules/room/room.module';
import { UserModule } from './modules/user/user.module';
import { TimerModule } from './modules/timer/timer.module';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
import { APP_FILTER } from '@nestjs/core';
import { GatewayModule } from './modules/gateway/gateway.module';
import { PrismaModule } from './common/prisma.module';
import { ResultModule } from './modules/result/result.module';
import { RouletteModule } from './modules/roulette/roulette.module';
import { RuleModule } from './modules/rule/rule.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { BullModule } from '@nestjs/bullmq';
import IORedis from 'ioredis';

import { RedisModule as CustomRedisModule } from './common/redis/redis.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    RoomModule,
    UserModule,
    TimerModule,
    SentryModule.forRoot(),
    CustomRedisModule,
    GatewayModule,
    RuleModule,
    ResultModule,
    RouletteModule,
    HealthModule,
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: new IORedis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: null,
        }),
      }),
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
})
export class AppModule {}
