import { Module } from '@nestjs/common';
import { RouletteService } from './roulette.service';
import { RouletteController } from './roulette.controller';

@Module({
  controllers: [RouletteController],
  providers: [RouletteService],
})
export class RouletteModule {}
