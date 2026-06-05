import { Module } from '@nestjs/common';
import { RouletteService } from './roulette.service';
import { RouletteController } from './roulette.controller';
import { GatewayModule } from '../gateway/gateway.module';
import { PenaltyModule } from '../penalty/penalty.module';

@Module({
  imports: [GatewayModule, PenaltyModule],
  controllers: [RouletteController],
  providers: [RouletteService],
})
export class RouletteModule {}
