import { Module, forwardRef } from '@nestjs/common';
import { RoomGateway } from './room/room.gateway';
import { YjsGateway } from './yjs/yjs.gateway';
import { JwtModule } from '@nestjs/jwt';
import { RoomModule } from '../room/room.module';
import { ConfigService } from '@nestjs/config';
import { EscapeModule } from '../escape/escape.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    forwardRef(() => RoomModule),
    EscapeModule,
  ],
  providers: [RoomGateway, YjsGateway],
  exports: [RoomGateway, YjsGateway],
})
export class GatewayModule {}
