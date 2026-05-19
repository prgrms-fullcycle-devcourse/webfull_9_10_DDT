import { Module } from '@nestjs/common';
import { TimerService } from './timer.service';
import { TimerController } from './timer.controller';

@Module({
  controllers: [TimerController],
  providers: [TimerService],
})
export class TimerModule {}
