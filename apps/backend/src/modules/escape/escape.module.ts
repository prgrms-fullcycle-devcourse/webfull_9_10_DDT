import { Module } from '@nestjs/common';
import { EscapeService } from './escape.service';
import { EscapeGateway } from './escape.gateway';
import { RoomModule } from '../room/room.module';

@Module({
  imports: [RoomModule],
  providers: [EscapeService, EscapeGateway],
  exports: [EscapeService],
})
export class EscapeModule {}