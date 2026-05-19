import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SocketGateway } from './socket.gateway'; 
import { RoomModule } from './modules/room/room.module';
import { UserModule } from './modules/user/user.module';
import { TimerModule } from './modules/timer/timer.module';

@Module({
  imports: [RoomModule, UserModule, TimerModule],
  controllers: [AppController],
  providers: [AppService, SocketGateway],
})
export class AppModule {}