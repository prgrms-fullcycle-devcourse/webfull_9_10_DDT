import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { nanoid } from 'nanoid';
import * as bcrypt from 'bcrypt';
import { JoinRoomDto } from './dto/join-room.dto';
import { Prisma } from '@prisma/client';

interface RoomMember {
  nickname: string;
  isLoggedIn: boolean;
  isHost: boolean;
  connected: boolean;
  profileImage: string;
  socketId?: string;
  isSigned?: boolean;
  canEdit?: boolean;
}

interface RoomState {
  roomCode: string;
  hostId: string;
  phase: string;
  members: Record<string, RoomMember>;
}

interface SignedStatus {
  allSigned: boolean;
  signedCount: number;
  totalCount: number;
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

  private readonly logger = new Logger(RoomService.name);
  private static readonly MAX_CODE_RETRIES = 5;

  async create(
    createRoomDto: CreateRoomDto,
    hostId: string,
  ): Promise<CreateRoomResult> {
    const { title, password } = createRoomDto;
    const passwordHash = await bcrypt.hash(password, 10);

    const room = await this.createRoomWithUniqueCode({
      title,
      hostId,
      passwordHash,
      phase: 'lobby',
    });

    const roomState: RoomState = {
      roomCode: room.code,
      hostId,
      phase: 'lobby',
      members: {},
    };

    await this.redisService.instance.set(
      `room:state:${room.code}`,
      JSON.stringify(roomState),
      'EX',
      7200,
    );

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    return {
      code: room.code,
      url: `${frontendUrl}/room/${room.code}`,
    };
  }

  /**
   * nanoid 코드가 PK(code)와 충돌(P2002)하면 새 코드로 재시도한다.
   */
  private async createRoomWithUniqueCode(data: {
    title: string;
    hostId: string;
    passwordHash: string;
    phase: string;
  }) {
    for (let attempt = 1; attempt <= RoomService.MAX_CODE_RETRIES; attempt++) {
      const code = nanoid(8);
      try {
        return await this.prismaService.room.create({
          data: { code, ...data },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          this.logger.warn(
            `방 코드 충돌 (시도 ${attempt}/${RoomService.MAX_CODE_RETRIES}): ${code}`,
          );
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException(
      '방 코드 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
    );
  }

  async find(code: string) {
    const room = await this.prismaService.room.findUnique({
      where: { code },
      select: {
        code: true,
        title: true,
        phase: true,
        _count: { select: { roomMembers: true } },
      },
    });

    if (!room) {
      throw new NotFoundException('존재하지 않는 방입니다.');
    }

    if (room.phase === 'result' || room.phase === 'closed') {
      throw new ForbiddenException('종료된 방입니다.');
    }

    return {
      title: room.title,
      id: room.code,
      memberCount: room._count.roomMembers,
      phase: room.phase,
    };
  }

  async join(
    code: string,
    joinRoomDto: JoinRoomDto,
    userId: string | null,
    guestToken: string | null,
  ): Promise<{ id: string; isReturning: boolean }> {
    const { nickname, password, profileImage } = joinRoomDto;
    const room = await this.prismaService.room.findUnique({
      where: { code },
      select: {
        code: true,
        passwordHash: true,
        phase: true,
        hostId: true,
        _count: { select: { roomMembers: true } },
      },
    });

    if (!room) {
      throw new NotFoundException('존재하지 않는 방입니다.');
    }

    const isBanned = await this.redisService.instance.get(
      `room:ban:${room.code}:${userId ?? guestToken}`,
    );
    if (isBanned) throw new ForbiddenException('강퇴된 방입니다.');

    if (room.phase === 'result' || room.phase === 'closed') {
      throw new ForbiddenException('종료된 방입니다.');
    }

    const existing = userId
      ? await this.prismaService.roomMember.findUnique({
          where: { roomCode_userId: { roomCode: room.code, userId } },
        })
      : null;

    const isReturning = userId
      ? !!existing
      : !!(
          guestToken &&
          (await this.prismaService.roomMember.findFirst({
            where: { roomCode: room.code, guestToken },
          }))
        );

    if (room.phase === 'timer' && !isReturning) {
      throw new ForbiddenException('이미 진행중인 방입니다.');
    }

    const isValid = await bcrypt.compare(password, room.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('비밀번호가 틀렸습니다.');
    }

    if (!isReturning && room._count.roomMembers >= 10) {
      throw new ConflictException('방이 가득 찼습니다.');
    }
    const isHostUser = userId === room.hostId;

    if (userId) {
      await this.prismaService.roomMember.upsert({
        where: { roomCode_userId: { roomCode: room.code, userId } },
        update: {
          nickname: existing ? existing.nickname : nickname,
          profileImage: existing ? existing.profileImage : profileImage,
        },
        create: {
          roomCode: room.code,
          userId,
          nickname,
          isHost: isHostUser,
          isLoggedIn: true,
          profileImage,
        },
      });

      const raw = await this.redisService.instance.get(
        `room:state:${room.code}`,
      );
      if (raw) {
        const state = JSON.parse(raw) as RoomState;
        if (!state.members[userId]) {
          state.members[userId] = {
            nickname,
            isLoggedIn: true,
            isHost: isHostUser,
            connected: true,
            profileImage,
            canEdit: isHostUser,
          };
          await this.redisService.instance.set(
            `room:state:${room.code}`,
            JSON.stringify(state),
            'EX',
            7200,
          );
        }
      }
    } else {
      if (!joinRoomDto.nickname) {
        throw new BadRequestException('닉네임을 입력해주세요.');
      }
      if (!guestToken) {
        throw new UnauthorizedException('게스트 토큰이 없습니다.');
      }
      if (!isReturning) {
        await this.prismaService.roomMember.create({
          data: {
            roomCode: room.code,
            userId: null,
            guestToken,
            nickname: joinRoomDto.nickname,
            isHost: false,
            isLoggedIn: false,
            profileImage: joinRoomDto.profileImage,
          },
        });

        const raw = await this.redisService.instance.get(
          `room:state:${room.code}`,
        );
        if (raw) {
          const state = JSON.parse(raw) as RoomState;
          state.members[guestToken] = {
            nickname,
            isLoggedIn: false,
            isHost: false,
            connected: true,
            profileImage,
            isSigned: false,
            canEdit: false,
          };
          await this.redisService.instance.set(
            `room:state:${room.code}`,
            JSON.stringify(state),
            'EX',
            7200,
          );
        }
      }
    }

    return { id: room.code, isReturning };
  }

  async transitionToContract(roomCode: string): Promise<RoomState | null> {
    const raw = await this.redisService.instance.get(`room:state:${roomCode}`);

    if (!raw) {
      return null;
    }

    const state = JSON.parse(raw) as RoomState;

    if (state.phase !== 'lobby') {
      return null;
    }

    state.phase = 'contract';

    await Promise.all([
      this.redisService.instance.set(
        `room:state:${roomCode}`,
        JSON.stringify(state),
        'EX',
        7200,
      ),
      this.updatePhase(roomCode, 'contract'),
    ]);

    return state;
  }

  async countConnectedMembers(roomCode: string): Promise<number> {
    const raw = await this.redisService.instance.get(`room:state:${roomCode}`);
    if (!raw) {
      return 0;
    }

    const state = JSON.parse(raw) as RoomState;

    const onlineMembersCount = Object.values(state.members).filter(
      (member) => member.isLoggedIn === true && member.connected,
    ).length;

    return onlineMembersCount;
  }

  async deleteRoom(roomCode: string): Promise<void> {
    await Promise.all([
      this.redisService.instance.del(`room:state:${roomCode}`),
      this.updatePhase(roomCode, 'closed'),
    ]);
  }

  async updatePhase(roomCode: string, phase: string): Promise<void> {
    await this.prismaService.room.update({
      where: { code: roomCode },
      data: { phase },
    });
  }

  async getRoomState(roomCode: string): Promise<RoomState | null> {
    const raw = await this.redisService.instance.get(`room:state:${roomCode}`);

    if (!raw) {
      return null;
    }

    const state = JSON.parse(raw) as RoomState;

    return state;
  }

  async setConnected(
    roomCode: string,
    userId: string,
    connected: boolean,
    socketId?: string,
  ): Promise<void> {
    const raw = await this.redisService.instance.get(`room:state:${roomCode}`);
    if (!raw) {
      this.logger.warn(`방 상태 없음: ${roomCode}`);
      return;
    }

    const state = JSON.parse(raw) as RoomState;
    if (!state.members[userId]) {
      this.logger.warn(`멤버 없음: ${userId} in ${roomCode}`);
      return;
    }

    if (state.members[userId]) {
      state.members[userId].connected = connected;

      if (connected && socketId) {
        state.members[userId].socketId = socketId;
      } else if (!connected) {
        state.members[userId].socketId = undefined;
      }

      await this.redisService.instance.set(
        `room:state:${roomCode}`,
        JSON.stringify(state),
        'EX',
        7200,
      );
    }
  }

  async kickMember(roomCode: string, targetId: string): Promise<void> {
    const isGuest = targetId.startsWith('guest_');

    await this.prismaService.roomMember.deleteMany({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: targetId } : { userId: targetId }),
      },
    });

    const raw = await this.redisService.instance.get(`room:state:${roomCode}`);
    if (raw) {
      const state = JSON.parse(raw) as RoomState;
      delete state.members[targetId];
      await this.redisService.instance.set(
        `room:state:${roomCode}`,
        JSON.stringify(state),
        'EX',
        7200,
      );
    }
    await this.redisService.instance.set(
      `room:ban:${roomCode}:${targetId}`,
      '1',
      'EX',
      7200,
    );
  }

  async setSigned(
    roomCode: string,
    userId: string,
    signed: boolean,
  ): Promise<SignedStatus | undefined> {
    const raw = await this.redisService.instance.get(`room:state:${roomCode}`);

    if (!raw) {
      return;
    }

    const state = JSON.parse(raw) as RoomState;

    if (!state.members[userId]) {
      return;
    }

    if (state.phase !== 'contract' && state.phase !== 'lobby') {
      return;
    }

    state.members[userId].isSigned = signed;

    await this.redisService.instance.set(
      `room:state:${roomCode}`,
      JSON.stringify(state),
      'EX',
      7200,
    );

    const members = Object.values(state.members);
    const signedCount = members.filter((m) => m.isSigned).length;
    const totalCount = members.length;

    return {
      allSigned: signedCount === totalCount,
      signedCount,
      totalCount,
    };
  }

  async resetAllSigns(
    roomCode: string,
  ): Promise<{ totalCount: number } | null> {
    const raws = await this.redisService.instance.get(`room:state:${roomCode}`);

    if (!raws) {
      return null;
    }

    const state = JSON.parse(raws) as RoomState;

    if (state.phase !== 'contract' && state.phase !== 'lobby') {
      return null;
    }

    const members = Object.values(state.members);

    const anySigned = members.some((m) => m.isSigned);
    if (!anySigned) return null;

    members.forEach((m) => (m.isSigned = false));

    await this.redisService.instance.set(
      `room:state:${roomCode}`,
      JSON.stringify(state),
      'EX',
      7200,
    );

    return { totalCount: members.length };
  }

  async setMemberEdit(
    id: string,
    userId: string,
    targetId: string,
    canEdit: boolean,
  ): Promise<boolean> {
    const raw = await this.redisService.instance.get(`room:state:${id}`);

    if (!raw) {
      return false;
    }

    const state = JSON.parse(raw) as RoomState;

    if (state.hostId !== userId) {
      return false;
    }

    if (!state.members[targetId]) {
      return false;
    }

    state.members[targetId].canEdit = canEdit;

    await this.redisService.instance.set(
      `room:state:${id}`,
      JSON.stringify(state),
      'EX',
      7200,
    );

    return true;
  }

  async setAllEdit(
    id: string,
    userId: string,
    canEdit: boolean,
  ): Promise<boolean> {
    const raw = await this.redisService.instance.get(`room:state:${id}`);

    if (!raw) {
      return false;
    }

    const state = JSON.parse(raw) as RoomState;

    if (state.hostId !== userId) {
      return false;
    }

    const members = Object.values(state.members);

    members.forEach((m) => {
      if (!m.isHost) {
        m.canEdit = canEdit;
      }
    });

    await this.redisService.instance.set(
      `room:state:${id}`,
      JSON.stringify(state),
      'EX',
      7200,
    );

    return true;
  }
}
