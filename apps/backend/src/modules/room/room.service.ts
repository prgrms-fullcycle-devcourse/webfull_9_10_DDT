import {
  ConflictException,
  ForbiddenException,
  Injectable,
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
import { Prisma, Room } from '@prisma/client';

type PartialRoom = Pick<Room, 'code' | 'passwordHash' | 'phase' | 'hostId'> & {
  _count: { roomMembers: number };
};

interface RoomMember {
  nickname: string;
  isLoggedIn: boolean;
  isHost: boolean;
  connected: boolean;
  profileImage: string;
  socketId?: string;
  isSigned?: boolean;
  canEdit?: boolean;
  gaveUpAt?: string | null;
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

const ROOM_STATE_TTL = 86400;

@Injectable()
export class RoomService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => RoomGateway))
    private readonly roomGateway: RoomGateway,
  ) {}
  private static readonly MAX_CODE_RETRIES = 5;

  public async getRedisState(roomCode: string): Promise<RoomState | null> {
    const raw = await this.redisService.instance.get(`room:state:${roomCode}`);
    return raw ? (JSON.parse(raw) as RoomState) : null;
  }

  public async saveRedisState(roomCode: string, state: RoomState) {
    await this.redisService.instance.set(
      `room:state:${roomCode}`,
      JSON.stringify(state),
      'EX',
      ROOM_STATE_TTL,
    );
  }

  private async getMemberRecord(
    roomCode: string,
    userId: string | null,
    guestToken: string | null,
  ) {
    const isGuest = !userId && !!guestToken;
    return this.prismaService.roomMember.findFirst({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: guestToken } : { userId: userId! }),
      },
    });
  }

  async create(
    createRoomDto: CreateRoomDto,
    hostId: string,
  ): Promise<CreateRoomResult> {
    const existing = await this.prismaService.room.findFirst({
      where: {
        hostId,
        phase: { notIn: ['closed', 'result'] },
      },
      include: {
        roomMembers: {
          where: { userId: hostId },
          select: { gaveUpAt: true },
        },
      },
    });

    if (existing) {
      const hostMember = existing.roomMembers[0];
      if (!hostMember?.gaveUpAt) {
        throw new ConflictException(
          `이미 진행중인 방이 있습니다. (${existing.title}, ${existing.code})`,
        );
      }
    }

    const passwordHash = await bcrypt.hash(createRoomDto.password, 10);
    
    const room = await this.createRoomWithUniqueCode({
      title: createRoomDto.title,
      hostId,
      passwordHash,
      phase: 'lobby',
    });

    await this.saveRedisState(room.code, {
      roomCode: room.code,
      hostId,
      phase: 'lobby',
      members: {},
    });

    return {
      code: room.code,
      url: `${this.configService.getOrThrow<string>('FRONTEND_URL')}/room/${room.code}`,
    };
  }

  async join(
    code: string,
    joinRoomDto: JoinRoomDto,
    userId: string | null,
    guestToken: string | null,
  ) {
    if (userId) {
      const alreadyInTimerRoom = await this.prismaService.roomMember.findFirst({
        where: { userId, room: { phase: 'timer' } },
      });
      if (alreadyInTimerRoom)
        throw new ConflictException('이미 다른 방에서 집중(timer) 중입니다.');
    }

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

    if (!room) throw new NotFoundException('존재하지 않는 방입니다.');
    if (room.phase === 'closed' || room.phase === 'result')
      throw new ForbiddenException('종료된 방입니다.');

    const targetId = userId ?? guestToken!;
    const isBanned = await this.redisService.instance.get(
      `room:ban:${room.code}:${targetId}`,
    );
    if (isBanned) throw new ForbiddenException('강퇴된 방입니다.');

    const returningMember = await this.getMemberRecord(
      room.code,
      userId,
      guestToken,
    );
    if (returningMember?.gaveUpAt)
      throw new ForbiddenException('이미 중도 포기하여 재입장 불가합니다.');
    if (room.phase === 'timer' && !returningMember)
      throw new ForbiddenException('이미 집중 세션이 시작된 방입니다.');
    if (!(await bcrypt.compare(joinRoomDto.password, room.passwordHash)))
      throw new UnauthorizedException('비밀번호가 틀렸습니다.');
    if (!returningMember && room._count.roomMembers >= 10)
      throw new ConflictException('방이 가득 찼습니다.');

    await this.handleMemberUpsert(
      room,
      joinRoomDto,
      userId,
      guestToken,
      !!returningMember,
    );
    return { id: room.code, isReturning: !!returningMember };
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
    if (!['lobby', 'contract'].includes(room.phase))
      throw new ForbiddenException('타이머 진행 중/종료된 방은 퇴장 불가.');

    const memberRecord = await this.getMemberRecord(
      roomCode,
      userId,
      guestToken,
    );
    if (!memberRecord)
      throw new NotFoundException('참여 정보를 찾을 수 없습니다.');

    if (room.hostId === userId) {
      await this.deleteRoom(roomCode);
      this.roomGateway.server
        .to(roomCode)
        .emit('room:closed', { reason: '방장이 퇴장했습니다.' });
      this.roomGateway.server.in(roomCode).disconnectSockets();
    } else {
      await this.prismaService.roomMember.delete({
        where: { id: memberRecord.id },
      });
      const state = await this.getRedisState(roomCode);
      if (state) {
        delete state.members[targetId];
        await this.saveRedisState(roomCode, state);
      }
      this.roomGateway.server
        .to(roomCode)
        .emit('member:left', { userId: targetId });
    }
    return { isHost: room.hostId === userId, targetId };
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
    if (!room || room.phase === 'closed')
      throw new NotFoundException('방을 찾을 수 없습니다.');
    return {
      title: room.title,
      id: room.code,
      memberCount: room._count.roomMembers,
      phase: room.phase,
    };
  }

  public async getRoomState(roomCode: string): Promise<RoomState | null> {
    return await this.getRedisState(roomCode);
  }
  public async transitionToContract(
    roomCode: string,
  ): Promise<RoomState | null> {
    const state = await this.getRedisState(roomCode);
    if (!state || state.phase !== 'lobby') return null;
    state.phase = 'contract';
    await this.saveRedisState(roomCode, state);
    await this.updatePhase(roomCode, 'contract');
    return state;
  }
  public async countConnectedMembers(roomCode: string): Promise<number> {
    const state = await this.getRedisState(roomCode);
    return state
      ? Object.values(state.members).filter((m) => m.connected).length
      : 0;
  }

  async setConnected(
    roomCode: string,
    userId: string,
    connected: boolean,
    socketId?: string,
  ) {
    const state = await this.getRedisState(roomCode);
    if (state?.members[userId]) {
      state.members[userId].connected = connected;
      state.members[userId].socketId = connected ? socketId : undefined;
      await this.saveRedisState(roomCode, state);
    }
  }

  async kickMember(roomCode: string, targetId: string) {
    const isGuest = targetId.startsWith('guest_');
    await this.prismaService.roomMember.deleteMany({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: targetId } : { userId: targetId }),
      },
    });
    const state = await this.getRedisState(roomCode);
    if (state) {
      delete state.members[targetId];
      await this.saveRedisState(roomCode, state);
    }
    await this.redisService.instance.set(
      `room:ban:${roomCode}:${targetId}`,
      '1',
      'EX',
      ROOM_STATE_TTL,
    );
  }

  async setSigned(
    roomCode: string,
    userId: string,
    signed: boolean,
  ): Promise<SignedStatus | undefined> {
    const state = await this.getRedisState(roomCode);
    if (
      !state ||
      !state.members[userId] ||
      !['contract', 'lobby'].includes(state.phase)
    )
      return;
    state.members[userId].isSigned = signed;
    await this.saveRedisState(roomCode, state);
    const members = Object.values(state.members);
    return {
      allSigned: members.every((m) => m.isSigned),
      signedCount: members.filter((m) => m.isSigned).length,
      totalCount: members.length,
    };
  }

  async resetAllSigns(roomCode: string) {
    const state = await this.getRedisState(roomCode);
    if (
      !state ||
      !['contract', 'lobby'].includes(state.phase) ||
      !Object.values(state.members).some((m) => m.isSigned)
    )
      return null;
    Object.values(state.members).forEach((m) => (m.isSigned = false));
    await this.saveRedisState(roomCode, state);
    return { totalCount: Object.keys(state.members).length };
  }

  async setMemberEdit(
    id: string,
    userId: string,
    targetId: string,
    canEdit: boolean,
  ) {
    const state = await this.getRedisState(id);
    if (state?.hostId === userId && state.members[targetId]) {
      state.members[targetId].canEdit = canEdit;
      await this.saveRedisState(id, state);
      return true;
    }
    return false;
  }

  async setAllEdit(id: string, userId: string, canEdit: boolean) {
    const state = await this.getRedisState(id);
    if (state?.hostId === userId) {
      Object.values(state.members).forEach((m) => {
        if (!m.isHost) m.canEdit = canEdit;
      });
      await this.saveRedisState(id, state);
      return true;
    }
    return false;
  }

  private async handleMemberUpsert(
    room: PartialRoom,
    dto: JoinRoomDto,
    userId: string | null,
    guestToken: string | null,
    isReturning: boolean,
  ) {
    const isHost = userId === room.hostId;
    if (userId) {
      await this.prismaService.roomMember.upsert({
        where: { roomCode_userId: { roomCode: room.code, userId } },
        update: { nickname: dto.nickname, profileImage: dto.profileImage },
        create: {
          roomCode: room.code,
          userId,
          nickname: dto.nickname,
          isHost,
          isLoggedIn: true,
          profileImage: dto.profileImage,
        },
      });
    } else if (!isReturning) {
      await this.prismaService.roomMember.create({
        data: {
          roomCode: room.code,
          guestToken: guestToken!,
          nickname: dto.nickname,
          isHost: false,
          isLoggedIn: false,
          profileImage: dto.profileImage,
        },
      });
    }
    const state = await this.getRedisState(room.code);
    if (state) {
      state.members[userId ?? guestToken!] = {
        nickname: dto.nickname,
        isLoggedIn: !!userId,
        isHost,
        connected: false,
        profileImage: dto.profileImage,
        canEdit: isHost,
      };
      await this.saveRedisState(room.code, state);
    }
  }

  private async createRoomWithUniqueCode(data: {
    title: string;
    hostId: string;
    passwordHash: string;
    phase: string;
  }) {
    for (let i = 0; i < RoomService.MAX_CODE_RETRIES; i++) {
      const code = nanoid(8);
      try {
        return await this.prismaService.room.create({
          data: { code, ...data },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        )
          continue;
        throw e;
      }
    }
    throw new ConflictException('방 코드 생성 실패.');
  }

  async deleteRoom(roomCode: string) {
    await Promise.all([
      this.redisService.instance.del(`room:state:${roomCode}`),
      this.updatePhase(roomCode, 'closed'),
    ]);
  }
  async updatePhase(roomCode: string, phase: string) {
    await this.prismaService.room.update({
      where: { code: roomCode },
      data: { phase },
    });
  }
  async updateRedisPhase(roomCode: string, phase: string) {
    const state = await this.getRedisState(roomCode);
    if (state) {
      state.phase = phase;
      await this.saveRedisState(roomCode, state);
    }
  }
  async findMyActiveRoom(userId: string) {
    const isGuest = userId.startsWith('guest_');
    if (isGuest) {
      return this.prismaService.room.findFirst({
        where: {
          phase: { notIn: ['closed', 'result'] },
          roomMembers: { some: { guestToken: userId, gaveUpAt: null } },
        },
        select: { code: true, phase: true, title: true },
      });
    }
    return this.prismaService.room.findFirst({
      where: {
        phase: { notIn: ['closed', 'result'] },
        OR: [
          { roomMembers: { some: { userId, gaveUpAt: null } } },
          { hostId: userId, roomMembers: { none: { userId } } },
        ],
      },
      select: { code: true, phase: true, title: true },
    });
  }
  async isMember(
    roomCode: string,
    userId: string | null,
    guestToken: string | null,
  ) {
    return !!(await this.getMemberRecord(roomCode, userId, guestToken));
  }
  async findRoomWithTemplate(roomCode: string) {
    return this.prismaService.room.findUnique({
      where: { code: roomCode },
      include: { template: true },
    });
  }
  async countActiveMembersInRoom(roomCode: string): Promise<number> {
    return this.prismaService.roomMember.count({
      where: { roomCode, gaveUpAt: null },
    });
  }
}