import { Module } from '@nestjs/common';
import { TimerService } from './timer.service';
import { TimerController } from './timer.controller';
import { GatewayModule } from '../gateway/gateway.module';
import { RoomModule } from '../room/room.module';
import { PenaltyModule } from '../penalty/penalty.module';

@Module({
  imports: [GatewayModule, RoomModule, PenaltyModule, GatewayModule],
  controllers: [TimerController],
  providers: [TimerService],
})
export class TimerModule {}
