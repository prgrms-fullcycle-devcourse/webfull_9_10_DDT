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
import { RoomGateway } from '../gateway/room/room.gateway';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { JoinRoomDto } from './dto/join-room.dto';
import { Room } from '@prisma/client';
import { RoomRepository, RoomState } from './room.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';

type PartialRoom = Pick<Room, 'code' | 'passwordHash' | 'phase' | 'hostId'> & {
  _count: { roomMembers: number };
};

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
    private readonly roomRepository: RoomRepository,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => RoomGateway))
    private readonly roomGateway: RoomGateway,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  public async saveRedisState(roomCode: string, state: RoomState) {
    await this.roomRepository.saveState(roomCode, state);
  }

  private async getMemberRecord(
    roomCode: string,
    userId: string | null,
    guestToken: string | null,
  ) {
    return this.roomRepository.findMember(roomCode, userId, guestToken);
  }

  async create(
    createRoomDto: CreateRoomDto,
    hostId: string,
  ): Promise<CreateRoomResult> {
    const existing = await this.roomRepository.findActiveRoomByHost(hostId);

    if (existing) {
      const hostMember = existing.roomMembers[0];
      if (!hostMember?.gaveUpAt) {
        throw new ConflictException(
          `이미 진행중인 방이 있습니다. (${existing.title}, ${existing.code})`,
        );
      }
    }

    const passwordHash = await bcrypt.hash(createRoomDto.password, 10);

    const room = await this.roomRepository.createWithUniqueCode({
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
      const alreadyInTimerRoom =
        await this.roomRepository.findMemberInTimerRoom(userId);
      if (alreadyInTimerRoom)
        throw new ConflictException('이미 다른 방에서 집중(timer) 중입니다.');
    }

    const room = await this.roomRepository.findByCode(code);

    if (!room) throw new NotFoundException('존재하지 않는 방입니다.');
    if (room.phase === 'closed' || room.phase === 'result')
      throw new ForbiddenException('종료된 방입니다.');

    const targetId = userId ?? guestToken!;
    const isBanned = await this.roomRepository.isBanned(code, targetId);
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

    const isHost = userId === room.hostId;
    if (
      !isHost &&
      !(await bcrypt.compare(joinRoomDto.password, room.passwordHash))
    )
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

    const room = await this.roomRepository.findByCode(roomCode);
    if (!room) throw new NotFoundException('방을 찾을 수 없습니다.');
    if (!['lobby', 'contract'].includes(room.phase))
      throw new ForbiddenException('타이머 진행 중/종료된 방은 퇴장 불가.');

    // 방장은 생성만 하고 입장하지 않았어도(멤버 레코드가 없어도) 방을 폭파할 수 있다.
    if (room.hostId === userId) {
      await this.deleteRoom(roomCode);
      this.roomGateway.server
        .to(roomCode)
        .emit('room:closed', { reason: '방장이 퇴장했습니다.' });
      this.roomGateway.server.in(roomCode).disconnectSockets();
      return { isHost: true, targetId };
    }

    // 참여자는 멤버 레코드가 있어야 퇴장할 수 있다.
    const memberRecord = await this.getMemberRecord(
      roomCode,
      userId,
      guestToken,
    );
    if (!memberRecord)
      throw new NotFoundException('참여 정보를 찾을 수 없습니다.');

    await this.roomRepository.deleteMemberById(memberRecord.id);
    const state = await this.roomRepository.getState(roomCode);
    if (state) {
      delete state.members[targetId];
      await this.saveRedisState(roomCode, state);
    }
    this.roomGateway.server
      .to(roomCode)
      .emit('member:left', { userId: targetId });
    return { isHost: false, targetId };
  }

  async find(code: string, userId?: string) {
    const room = await this.roomRepository.findByCodeWithTitle(code);
    if (!room || room.phase === 'closed')
      throw new NotFoundException('방을 찾을 수 없습니다.');
    return {
      title: room.title,
      id: room.code,
      memberCount: room._count.roomMembers,
      phase: room.phase,
      isHost: !!userId && room.hostId === userId,
    };
  }

  public getRoomState(roomCode: string): Promise<RoomState | null> {
    return this.roomRepository.getState(roomCode);
  }
  public async transitionToContract(
    roomCode: string,
  ): Promise<RoomState | null> {
    const state = await this.roomRepository.getState(roomCode);
    if (!state || state.phase !== 'lobby') return null;
    state.phase = 'contract';
    await this.saveRedisState(roomCode, state);
    await this.updatePhase(roomCode, 'contract');
    return state;
  }
  public async countConnectedMembers(roomCode: string): Promise<number> {
    const state = await this.roomRepository.getState(roomCode);
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
    const state = await this.roomRepository.getState(roomCode);
    if (state?.members[userId]) {
      state.members[userId].connected = connected;
      state.members[userId].socketId = connected ? socketId : undefined;
      await this.saveRedisState(roomCode, state);
    }
  }

  async kickMember(roomCode: string, targetId: string) {
    await this.roomRepository.deleteMember(roomCode, targetId);
    const state = await this.roomRepository.getState(roomCode);
    if (state) {
      delete state.members[targetId];
      await this.saveRedisState(roomCode, state);
    }
    await this.roomRepository.setBan(roomCode, targetId);
  }

  async setSigned(
    roomCode: string,
    userId: string,
    signed: boolean,
  ): Promise<SignedStatus | undefined> {
    const state = await this.roomRepository.getState(roomCode);
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
    const state = await this.roomRepository.getState(roomCode);
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
    const state = await this.roomRepository.getState(id);
    if (state?.hostId === userId && state.members[targetId]) {
      state.members[targetId].canEdit = canEdit;
      await this.saveRedisState(id, state);
      return true;
    }
    return false;
  }

  async setAllEdit(id: string, userId: string, canEdit: boolean) {
    const state = await this.roomRepository.getState(id);
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
      await this.roomRepository.upsertUserMember(room.code, userId, {
        nickname: dto.nickname,
        profileImage: dto.profileImage,
        isHost,
      });
    } else if (!isReturning) {
      await this.roomRepository.createGuestMember(room.code, guestToken!, {
        nickname: dto.nickname,
        profileImage: dto.profileImage,
      });
    }
    const state = await this.roomRepository.getState(room.code);
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

  async deleteRoom(roomCode: string) {
    await Promise.all([
      this.roomRepository.deleteState(roomCode),
      this.updatePhase(roomCode, 'closed'),
    ]);
    this.eventEmitter.emit('room.closed', { roomCode });
  }
  async updatePhase(roomCode: string, phase: string) {
    await this.roomRepository.updatePhase(roomCode, phase);
  }
  async updateRedisPhase(roomCode: string, phase: string) {
    const state = await this.roomRepository.getState(roomCode);
    if (state) {
      state.phase = phase;
      await this.saveRedisState(roomCode, state);
    }
  }
  async findMyActiveRoom(userId: string) {
    const isGuest = userId.startsWith('guest_');
    if (isGuest) {
      return this.roomRepository.findActiveRoomByGuest(userId);
    }
    return this.roomRepository.findActiveRoomByUser(userId);
  }
  async isMember(
    roomCode: string,
    userId: string | null,
    guestToken: string | null,
  ) {
    return !!(await this.getMemberRecord(roomCode, userId, guestToken));
  }

  async findRoomWithTemplate(roomCode: string) {
    return this.roomRepository.findByCodeWithTemplate(roomCode);
  }

  async countActiveMembersInRoom(roomCode: string): Promise<number> {
    return this.roomRepository.countActiveMembers(roomCode);
  }
}
