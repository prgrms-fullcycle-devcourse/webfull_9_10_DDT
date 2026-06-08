import { Module, forwardRef } from '@nestjs/common';
import { GatewayModule } from '../gateway/gateway.module';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { EscapeModule } from '../escape/escape.module';

@Module({
  imports: [forwardRef(() => GatewayModule), EscapeModule],
  controllers: [RoomController],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}
