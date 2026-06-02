import { Module } from '@nestjs/common';
import { ResultService } from './result.service';
import { ResultController } from './result.controller';
import { PenaltyModule } from '../penalty/penalty.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [PenaltyModule, GatewayModule],
  controllers: [ResultController],
  providers: [ResultService],
})
export class ResultModule {}
