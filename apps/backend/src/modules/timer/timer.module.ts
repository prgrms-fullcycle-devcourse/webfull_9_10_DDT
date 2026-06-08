import { Module } from '@nestjs/common';
import { TimerService } from './timer.service';
import { TimerController } from './timer.controller';
import { GatewayModule } from '../gateway/gateway.module';
import { RoomModule } from '../room/room.module';
import { PenaltyModule } from '../penalty/penalty.module';
import { BullModule } from '@nestjs/bullmq';
import { SESSION_QUEUE } from './timer.queue';
import { SessionProcessor } from './session.processor';
import { EscapeModule } from '../escape/escape.module';
@Module({
  imports: [
    GatewayModule,
    RoomModule,
    PenaltyModule,
    BullModule.registerQueue({ name: SESSION_QUEUE }),
    EscapeModule,
  ],
  controllers: [TimerController],
  providers: [TimerService, SessionProcessor],
  exports: [TimerService],
})
export class TimerModule {}
