import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { RoomGateway } from '../gateway/room/room.gateway';
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
    @Inject(forwardRef(() => RoomGateway))
    private readonly roomGateway: RoomGateway,
  ) {}

  private readonly logger = new Logger(RoomService.name);
  private static readonly MAX_CODE_RETRIES = 5;

  async create(
    createRoomDto: CreateRoomDto,
    hostId: string,
  ): Promise<CreateRoomResult> {
    const existing = await this.prismaService.room.findFirst({
      where: {
        hostId,
        phase: { notIn: ['closed', 'result'] },
      },
      select: { code: true, phase: true, title: true },
    });

    if (existing) {
      throw new ConflictException('이미 진행중인 방이 있습니다.');
    }
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

  async leaveRoom(
    roomCode: string,
    userId: string | null,
    guestToken: string | null,
  ) {
    const targetId = userId ?? guestToken;
    if (!targetId) throw new UnauthorizedException('인증 정보가 없습니다.');

    const room = await this.prismaService.room.findUnique({
      where: { code: roomCode },
    });

    if (!room) throw new NotFoundException('방을 찾을 수 없습니다.');
    if (room.phase !== 'lobby' && room.phase !== 'contract') {
      throw new ForbiddenException(
        '타이머 진행 중이거나 종료된 방은 퇴장할 수 없습니다. (진행 중일 경우 중도 포기를 이용하세요)',
      );
    }

    const isGuest = !userId && !!guestToken;
    const memberRecord = await this.prismaService.roomMember.findFirst({
      where: { roomCode, ...(isGuest ? { guestToken } : { userId }) },
    });

    if (!memberRecord)
      throw new NotFoundException('참여 정보를 찾을 수 없습니다.');

    const isHost = room.hostId === userId;

    if (isHost) {
      await this.prismaService.room.update({
        where: { code: roomCode },
        data: { phase: 'closed' },
      });
      await this.redisService.instance.del(`room:state:${roomCode}`);

      this.roomGateway.server.to(roomCode).emit('room:closed', {
        reason: '방장이 퇴장하여 방이 폐쇄되었습니다.',
      });
      this.roomGateway.server.in(roomCode).disconnectSockets();
    } else {
      await this.prismaService.roomMember.delete({
        where: { id: memberRecord.id },
      });

      const raw = await this.redisService.instance.get(
        `room:state:${roomCode}`,
      );
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
      this.roomGateway.server
        .to(roomCode)
        .emit('member:left', { userId: targetId });
    }
    return { isHost, targetId };
  }

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

    const guestExisting = guestToken
      ? await this.prismaService.roomMember.findFirst({
          where: { roomCode: room.code, guestToken },
        })
      : null;

    const returningMember = existing || guestExisting;

    if (returningMember?.gaveUpAt) {
      throw new ForbiddenException('이미 중도 포기하여 다시 입장할 수 없습니다.');
    }

    const isReturning = !!returningMember;

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
            connected: false,
            profileImage,
            canEdit: isHostUser,
          };
          await this.redisService.instance.set(
            `room:state:${room.code}`,
            JSON.stringify(state),
            'EX',
            86400,
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
            connected: false,
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
      (member) => member.connected,
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

  async updateRedisPhase(roomCode: string, phase: string) {
    const raw = await this.redisService.instance.get(`room:state:${roomCode}`);
    if (!raw) return;

    const state = JSON.parse(raw) as RoomState;
    state.phase = phase;
    await this.redisService.instance.set(
      `room:state:${roomCode}`,
      JSON.stringify(state),
      'EX',
      7200,
    );
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

  // 💡 방 조회 시, 중도 포기(gaveUpAt)한 멤버는 복귀 대상에서 제외되도록 개선!
  async findMyActiveRoom(userId: string) {
    const isGuest = userId.startsWith('guest_');
    return this.prismaService.room.findFirst({
      where: {
        phase: { notIn: ['closed', 'result'] },
        roomMembers: {
          some: {
            ...(isGuest ? { guestToken: userId } : { userId }),
            gaveUpAt: null, // 포기한 방은 복귀 모달 안 뜨게 필터링
          },
        },
      },
      select: { code: true, phase: true, title: true },
    });
  }

  async isMember(
    roomCode: string,
    userId: string | null,
    guestToken: string | null,
  ): Promise<boolean> {
    const targetId = userId ?? guestToken;
    if (!targetId) {
      return false;
    }

    const isGuest = !!guestToken;
    const member = await this.prismaService.roomMember.findFirst({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: targetId } : { userId: targetId }),
      },
    });

    return !!member;
  }

  async findRoomWithTemplate(roomCode: string) {
    return this.prismaService.room.findUnique({
      where: { code: roomCode },
      include: { template: true },
    });
  }
}
