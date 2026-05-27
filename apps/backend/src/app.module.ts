import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
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

import { RedisModule as CustomRedisModule } from './common/redis/redis.module';

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
