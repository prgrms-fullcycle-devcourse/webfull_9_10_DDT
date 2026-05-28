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
  roomId: string;
  code: string;
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

  async create(
    createRoomDto: CreateRoomDto,
    hostId: string,
  ): Promise<CreateRoomResult> {
    const { title, password, nickname, profileImage } = createRoomDto;

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

    await this.prismaService.roomMember.create({
      data: {
        roomId: room.id,
        userId: hostId,
        nickname: nickname,
        isHost: true,
        isLoggedIn: true,
        profileImage: profileImage,
      },
    });

    const roomState: RoomState = {
      roomId: room.id,
      code: room.code,
      hostId,
      phase: 'lobby',
      members: {
        [hostId]: {
          nickname,
          isLoggedIn: true,
          isHost: true,
          connected: false,
          profileImage,
          canEdit: true,
        },
      },
    };

    await this.redisService.instance.set(
      `room:state:${room.id}`,
      JSON.stringify(roomState),
      'EX',
      7200,
    );

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    return {
      code,
      url: `${frontendUrl}/room/${room.id}`,
    };
  }

  async find(identifier: { id: string } | { code: string }) {
    const room = await this.prismaService.room.findUnique({
      where: identifier,
      select: {
        id: true,
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
      id: room.id,
      memberCount: room._count.roomMembers,
      phase: room.phase,
    };
  }

  async join(
    identifier: { id: string } | { code: string },
    joinRoomDto: JoinRoomDto,
    userId: string | null,
    guestToken: string | null,
  ): Promise<{ id: string; isReturning: boolean }> {
    const { nickname, password, profileImage } = joinRoomDto;
    const room = await this.prismaService.room.findUnique({
      where: identifier,
      select: {
        id: true,
        passwordHash: true,
        phase: true,
        _count: { select: { roomMembers: true } },
      },
    });

    if (!room) {
      throw new NotFoundException('존재하지 않는 방입니다.');
    }

    const isBanned = await this.redisService.instance.get(
      `room:ban:${room.id}:${userId ?? guestToken}`,
    );
    if (isBanned) throw new ForbiddenException('강퇴된 방입니다.');

    if (room.phase === 'result' || room.phase === 'closed') {
      throw new ForbiddenException('종료된 방입니다.');
    }

    const existing = userId
      ? await this.prismaService.roomMember.findUnique({
          where: { roomId_userId: { roomId: room.id, userId } },
        })
      : null;

    const isReturning = userId
      ? !!existing
      : !!(
          guestToken &&
          (await this.prismaService.roomMember.findFirst({
            where: { roomId: room.id, guestToken },
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

    if (userId) {
      await this.prismaService.roomMember.upsert({
        where: {
          roomId_userId: { roomId: room.id, userId },
        },
        update: {
          nickname: existing ? existing.nickname : nickname, // 재접속이면 기존 닉네임 유지
          profileImage: existing ? existing.profileImage : profileImage,
        },
        create: {
          roomId: room.id,
          userId,
          nickname: nickname,
          isHost: false,
          isLoggedIn: true,
          profileImage,
        },
      });

      const raw = await this.redisService.instance.get(`room:state:${room.id}`);
      if (raw) {
        const state = JSON.parse(raw) as RoomState;

        if (!state.members[userId]) {
          state.members[userId] = {
            nickname,
            isLoggedIn: true,
            isHost: false,
            connected: false,
            profileImage,
          };
          await this.redisService.instance.set(
            `room:state:${room.id}`,
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
            roomId: room.id,
            userId: null,
            guestToken,
            nickname: joinRoomDto.nickname,
            isHost: false,
            isLoggedIn: false,
            profileImage: joinRoomDto.profileImage,
          },
        });

        const raw = await this.redisService.instance.get(
          `room:state:${room.id}`,
        );

        if (raw) {
          const state = JSON.parse(raw) as RoomState;

          state.members[guestToken] = {
            nickname,
            isLoggedIn: false,
            isHost: false,
            connected: false,
            profileImage,
          };
          await this.redisService.instance.set(
            `room:state:${room.id}`,
            JSON.stringify(state),
            'EX',
            7200,
          );
        }
      }
    }

    return { id: room.id, isReturning };
  }

  async transitionToContract(id: string): Promise<RoomState | null> {
    const raw = await this.redisService.instance.get(`room:state:${id}`);

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
        `room:state:${id}`,
        JSON.stringify(state),
        'EX',
        7200,
      ),
      this.updatePhase(id, 'contract'),
    ]);

    return state;
  }

  async countConnectedMembers(id: string): Promise<number> {
    const raw = await this.redisService.instance.get(`room:state:${id}`);
    if (!raw) {
      return 0;
    }

    const state = JSON.parse(raw) as RoomState;

    const onlineMembersCount = Object.values(state.members).filter(
      (member) => member.isLoggedIn === true && member.connected,
    ).length;

    return onlineMembersCount;
  }

  async deleteRoom(id: string): Promise<void> {
    await Promise.all([
      this.redisService.instance.del(`room:state:${id}`),
      this.updatePhase(id, 'closed'),
    ]);
  }

  async updatePhase(id: string, phase: string): Promise<void> {
    await this.prismaService.room.update({ where: { id }, data: { phase } });
  }

  async getRoomState(id: string): Promise<RoomState | null> {
    const raw = await this.redisService.instance.get(`room:state:${id}`);

    if (!raw) {
      return null;
    }

    const state = JSON.parse(raw) as RoomState;

    return state;
  }

  async setConnected(
    id: string,
    userId: string,
    connected: boolean,
    socketId?: string,
  ): Promise<void> {
    const raw = await this.redisService.instance.get(`room:state:${id}`);
    if (!raw) {
      this.logger.warn(`방 상태 없음: ${id}`);
      return;
    }

    const state = JSON.parse(raw) as RoomState;
    if (!state.members[userId]) {
      this.logger.warn(`멤버 없음: ${userId} in ${id}`);
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
        `room:state:${id}`,
        JSON.stringify(state),
        'EX',
        7200,
      );
    }
  }

  async kickMember(id: string, targetId: string): Promise<void> {
    const isGuest = targetId.startsWith('guest_');

    await this.prismaService.roomMember.deleteMany({
      where: {
        roomId: id,
        ...(isGuest ? { guestToken: targetId } : { userId: targetId }),
      },
    });

    const raw = await this.redisService.instance.get(`room:state:${id}`);
    if (raw) {
      const state = JSON.parse(raw) as RoomState;
      delete state.members[targetId];
      await this.redisService.instance.set(
        `room:state:${id}`,
        JSON.stringify(state),
        'EX',
        7200,
      );
    }
    await this.redisService.instance.set(
      `room:ban:${id}:${targetId}`,
      '1',
      'EX',
      7200,
    );
  }

  async setSigned(
    id: string,
    userId: string,
    signed: boolean,
  ): Promise<SignedStatus | undefined> {
    const raw = await this.redisService.instance.get(`room:state:${id}`);

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
      `room:state:${id}`,
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

  async resetAllSigns(id: string): Promise<{ totalCount: number } | null> {
    const raw = await this.redisService.instance.get(`room:state:${id}`);

    if (!raw) {
      return null;
    }

    const state = JSON.parse(raw) as RoomState;

    if (state.phase !== 'contract' && state.phase !== 'lobby') {
      return null;
    }

    const members = Object.values(state.members);

    const anySigned = members.some((m) => m.isSigned);
    if (!anySigned) return null;

    members.forEach((m) => (m.isSigned = false));

    await this.redisService.instance.set(
      `room:state:${id}`,
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
