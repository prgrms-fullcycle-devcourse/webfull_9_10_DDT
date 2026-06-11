import { Module, forwardRef } from '@nestjs/common';
import { TimerService } from './timer.service';
import { TimerController } from './timer.controller';
import { GatewayModule } from '../gateway/gateway.module';
import { RoomModule } from '../room/room.module';
import { PenaltyModule } from '../penalty/penalty.module';
import { BullModule } from '@nestjs/bullmq';
import { SESSION_QUEUE } from './timer.queue';
import { SessionProcessor } from './session.processor';
import { EscapeModule } from '../escape/escape.module';
import { TimerRepository } from './timer.repository';

@Module({
  imports: [
    forwardRef(() => GatewayModule),
    forwardRef(() => RoomModule),
    PenaltyModule,
    BullModule.registerQueue({ name: SESSION_QUEUE }),
    forwardRef(() => EscapeModule),
  ],
  controllers: [TimerController],
  providers: [
    TimerService,
    SessionProcessor,
    TimerRepository,
  ],
  exports: [TimerService],
})
export class TimerModule {}
