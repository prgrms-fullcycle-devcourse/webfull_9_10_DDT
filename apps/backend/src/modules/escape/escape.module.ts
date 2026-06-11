import { Module,forwardRef } from '@nestjs/common';
import { EscapeService } from './escape.service';
import { HeartBeatExpirationService } from './heartbeat-expiration.service';
import { TimerModule } from '../timer/timer.module';

@Module({
  imports: [forwardRef(() => TimerModule)],
  providers: [EscapeService, HeartBeatExpirationService],
  exports: [EscapeService],
})
export class EscapeModule {}
