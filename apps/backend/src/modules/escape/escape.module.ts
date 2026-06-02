import { Module } from '@nestjs/common';
import { EscapeService } from './escape.service';
import { EscapeGateway } from './escape.gateway';

@Module({
  providers: [EscapeService, EscapeGateway],
  exports: [EscapeService],
})
export class EscapeModule {}
