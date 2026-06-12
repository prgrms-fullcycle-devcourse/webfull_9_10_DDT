import { Module } from '@nestjs/common';
import { EscapeService } from './escape.service';
import { HeartBeatExpirationService } from './heartbeat-expiration.service';

@Module({
  imports: [],
  providers: [EscapeService, HeartBeatExpirationService],
  exports: [EscapeService],
})
export class EscapeModule {}
