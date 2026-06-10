import { Module, forwardRef } from '@nestjs/common';
import { GatewayModule } from '../gateway/gateway.module';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { EscapeModule } from '../escape/escape.module';
import { RoomRepository } from './room.repository';

@Module({
  imports: [forwardRef(() => GatewayModule), EscapeModule],
  controllers: [RoomController],
  providers: [RoomService, RoomRepository],
  exports: [RoomService],
})
export class RoomModule {}
