/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { nanoid } from 'nanoid';
import * as bcrypt from 'bcrypt';

interface RoomState {
  roomId: string;
  code: string;
  hostId: string;
  phase: string;
  members: Record<string, unknown>;
}

export interface CreateRoomResult {
  code: string;
  url: string;
}

@Injectable()
export class RoomService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    createRoomDto: CreateRoomDto,
    hostId: string,
  ): Promise<CreateRoomResult> {
    const { title, password } = createRoomDto;

    const code = nanoid(8);
    const passwordHash = await bcrypt.hash(password, 10);

    const room = await this.prismaService.room.create({
      data: {
        code,
        title,
        hostId,
        passwordHash,
        phase: 'lobby',
      },
    });

    const roomState: RoomState = {
      roomId: room.id,
      code: room.code,
      hostId,
      phase: 'lobby',
      members: {},
    };

    await this.redisService.instance.set(
      `room:state:${room.id}`,
      JSON.stringify(roomState),
      'EX',
      7200,
    );

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    return {
      code: code,
      url: `${frontendUrl}/room/${room.code}`,
    };
  }

  findAll() {
    return `This action returns all room`;
  }

  findOne(id: number) {
    return `This action returns a #${id} room`;
  }

  update(id: number, updateRoomDto: UpdateRoomDto) {
    return `This action updates a #${id} room`;
  }

  remove(id: number) {
    return `This action removes a #${id} room`;
  }
}
