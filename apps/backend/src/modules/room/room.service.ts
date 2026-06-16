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

/** 방 생성 API 응답 */
export interface CreateRoomResult {
  code: string;
  url: string;
}

/**
 * 방 생성, 입장, 퇴장, 멤버 관리 등 방의 생명주기를 담당하는 서비스.
 * Redis에 방 상태를 캐싱하고, DB와 동기화합니다.
 */
@Injectable()
export class RoomService {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => RoomGateway))
    private readonly roomGateway: RoomGateway,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Redis 방 상태를 저장하고 Socket.IO로 전체 멤버에게 브로드캐스트합니다.
   *
   * @param roomCode - 방 코드
   * @param state - 저장할 상태 객체
   */
  public async saveRedisState(roomCode: string, state: RoomState) {
    await this.roomRepository.saveState(roomCode, state);
  }

  /**
   * DB에서 roomCode + userId/guestToken으로 멤버 레코드를 조회합니다.
   * 재입장 여부, 퇴장 권한 확인 등 내부 검증에 사용됩니다.
   */
  private async getMemberRecord(
    roomCode: string,
    userId: string | null,
    guestToken: string | null,
  ) {
    return this.roomRepository.findMember(roomCode, userId, guestToken);
  }

  /**
   * 새 방을 생성합니다. 호스트를 자동으로 멤버에 추가합니다.
   *
   * @param dto - 방 생성 DTO (title, password, maxMembers)
   * @param userId - 방장의 userId (로그인 유저)
   * @param guestToken - 방장의 guestToken (게스트)
   * @returns 생성된 방 정보
   */
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

  /**
   * 방에 입장합니다. 비밀번호, 강퇴 여부, 정원, 중복 입장 등을 검증합니다.
   * 게스트는 새 토큰 발급, 기존 멤버는 재입장(isReturning) 처리합니다.
   *
   * @param code - 방 코드
   * @param dto - 입장 DTO (nickname, password, profileImage)
   * @param userId - 로그인 유저 ID
   * @param guestToken - 게스트 토큰
   * @returns 방 정보 + accessToken (게스트인 경우)
   * @throws ConflictException 다른 방에서 진행 중인 경우
   * @throws ForbiddenException 강퇴/중도포기/세션 시작 후 입장 시도
   */
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
        throw new ConflictException('이미 다른 방에서 수감 중입니다.');
    }

    const room = await this.roomRepository.findByCode(code);

    if (!room) throw new NotFoundException('존재하지 않는 방입니다.');
    if (room.phase === 'closed' || room.phase === 'result')
      throw new ForbiddenException('종료된 방입니다.');

    const targetId = userId ?? guestToken!;
    const isBanned = await this.roomRepository.isBanned(code, targetId);
    if (isBanned) throw new ForbiddenException('강퇴당한 방입니다.');

    const returningMember = await this.getMemberRecord(
      room.code,
      userId,
      guestToken,
    );
    if (returningMember?.gaveUpAt)
      throw new ForbiddenException('이미 탈옥하여 재입장 불가합니다.');
    if (room.phase === 'timer' && !returningMember)
      throw new ForbiddenException('이미 수감이 시작된 방입니다.');

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

  /**
   * 방에서 퇴장합니다.
   * 방장이 나가면 방 전체가 삭제(폭파)됩니다.
   * 일반 멤버는 DB + Redis에서 제거됩니다.
   *
   * @param roomCode - 방 코드
   * @param userId - 퇴장할 유저 ID
   * @param guestToken - 퇴장할 게스트 토큰
   */
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
      throw new ForbiddenException('수감 진행 중/종료된 방은 퇴장 불가.');

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

  /**
   * 방 코드로 방 정보를 조회하여 화면 표시용 요약을 반환합니다.
   *
   * @param code - 방 코드
   * @param userId - 조회하는 유저 ID (호스트 여부 판별용)
   * @returns 방 제목, 멤버 수, 페이즈, 호스트 여부
   * @throws NotFoundException 방이 없거나 closed 상태일 때
   */
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

  /**
   * Redis에서 방의 실시간 상태를 조회합니다.
   * RoomRepository.getState의 공개 래퍼입니다.
   *
   * @param roomCode - 방 코드
   * @returns 방 상태 객체 또는 null
   */
  public getRoomState(roomCode: string): Promise<RoomState | null> {
    return this.roomRepository.getState(roomCode);
  }

  /**
   * 방 상태를 lobby → contract 페이즈로 전환합니다.
   *
   * @param roomCode - 방 코드
   */
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

  /**
   * 방에서 현재 소켓 연결 중인 멤버 수를 반환합니다.
   *
   * @param roomCode - 방 코드
   * @returns 연결 중인 멤버 수
   */
  public async countConnectedMembers(roomCode: string): Promise<number> {
    const state = await this.roomRepository.getState(roomCode);
    return state
      ? Object.values(state.members).filter((m) => m.connected).length
      : 0;
  }

  /**
   * 멤버의 소켓 연결 상태를 Redis에 반영합니다.
   * Socket.IO 연결/해제 시 RoomGateway에서 호출됩니다.
   *
   * @param roomCode - 방 코드
   * @param userId - 유저 ID
   * @param connected - 연결 여부
   * @param socketId - 소켓 ID (연결 시에만)
   */
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

  /**
   * 특정 멤버를 강퇴합니다.
   * Redis에서 멤버를 제거하고 강퇴 목록(ban)에 추가합니다.
   *
   * @param roomCode - 방 코드
   * @param targetId - 강퇴 대상 userId 또는 guestToken
   */
  async kickMember(roomCode: string, targetId: string) {
    await this.roomRepository.deleteMember(roomCode, targetId);
    const state = await this.roomRepository.getState(roomCode);
    if (state) {
      delete state.members[targetId];
      await this.saveRedisState(roomCode, state);
    }
    await this.roomRepository.setBan(roomCode, targetId);
  }

  /**
   * 멤버의 서명 상태를 변경합니다.
   * 서명이 변경되면 Socket.IO로 전체 멤버에게 브로드캐스트합니다.
   *
   * @param roomCode - 방 코드
   * @param userId - 서명할 유저 ID
   * @param signed - 서명 여부
   */
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

  /**
   * 방의 모든 멤버 서명을 초기화합니다.
   * 계약서 내용 변경 시 호출되어 재서명을 유도합니다.
   *
   * @param roomCode - 방 코드
   * @returns { totalCount } 또는 null (이미 초기화됐거나 페이즈 불일치 시)
   */
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

  /**
   * 특정 멤버의 편집 권한을 변경합니다. (방장만 호출 가능)
   *
   * @param id - 방 코드
   * @param userId - 요청자 ID (방장 검증용)
   * @param targetId - 편집 권한을 변경할 대상 멤버 ID
   * @param canEdit - 편집 허용 여부
   * @returns 성공 시 true, 권한 없으면 false
   */
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

  /**
   * 방장을 제외한 전체 멤버의 편집 권한을 일괄 변경합니다.
   *
   * @param id - 방 코드
   * @param userId - 요청자 ID (방장 검증용)
   * @param canEdit - 편집 허용 여부
   * @returns 성공 시 true, 권한 없으면 false
   */
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

  /**
   * 새 멤버를 Redis 상태에 추가하거나, 재입장 멤버의 정보를 갱신합니다.
   * 호스트의 편집 권한 설정(editPermission)에 따라 canEdit이 결정됩니다.
   */
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

  /**
   * 방을 삭제하고 'room.closed' 이벤트를 발행합니다.
   * TimerService에서 이벤트를 수신하여 BullMQ 잡 취소 + Y.Doc 정리를 수행합니다.
   *
   * @param roomCode - 삭제할 방 코드
   */
  async deleteRoom(roomCode: string) {
    await Promise.all([
      this.roomRepository.deleteState(roomCode),
      this.updatePhase(roomCode, 'closed'),
    ]);
    this.eventEmitter.emit('room.closed', { roomCode });
  }

  /**
   * DB에서 방의 페이즈를 업데이트합니다.
   *
   * @param roomCode - 방 코드
   * @param phase - 변경할 페이즈 문자열
   */
  async updatePhase(roomCode: string, phase: string) {
    await this.roomRepository.updatePhase(roomCode, phase);
  }

  /**
   * Redis 방 상태의 페이즈만 업데이트합니다. (DB는 변경하지 않음)
   * Socket.IO 브로드캐스트용으로 Redis 상태를 선반영할 때 사용됩니다.
   *
   * @param roomCode - 방 코드
   * @param phase - 변경할 페이즈 문자열
   */
  async updateRedisPhase(roomCode: string, phase: string) {
    const state = await this.roomRepository.getState(roomCode);
    if (state) {
      state.phase = phase;
      await this.saveRedisState(roomCode, state);
    }
  }

  /**
   * 유저가 현재 참여 중인 활성 방을 조회합니다.
   * guest_ 접두사로 게스트 여부를 판별하여 적절한 쿼리를 호출합니다.
   * 앱 재접속 시 자동 복귀에 사용됩니다.
   *
   * @param userId - 유저 ID 또는 게스트 토큰
   * @returns { code, phase, title } 또는 null
   */
  async findMyActiveRoom(userId: string) {
    const isGuest = userId.startsWith('guest_');
    if (isGuest) {
      return this.roomRepository.findActiveRoomByGuest(userId);
    }
    return this.roomRepository.findActiveRoomByUser(userId);
  }

  /**
   * 특정 유저가 방의 멤버인지 확인합니다.
   *
   * @param roomCode - 방 코드
   * @param userId - 로그인 유저 ID
   * @param guestToken - 게스트 토큰
   * @returns 멤버이면 true
   */
  async isMember(
    roomCode: string,
    userId: string | null,
    guestToken: string | null,
  ) {
    return !!(await this.getMemberRecord(roomCode, userId, guestToken));
  }

  /**
   * 방 + 세션 템플릿을 함께 조회합니다.
   * 타이머 시작 시 세션 설정값 참조에 사용됩니다.
   *
   * @param roomCode - 방 코드
   * @returns Room (template 포함) 또는 null
   */
  async findRoomWithTemplate(roomCode: string) {
    return this.roomRepository.findByCodeWithTemplate(roomCode);
  }

  /**
   * 방에서 중도포기하지 않은 활성 멤버 수를 반환합니다.
   * 마지막 멤버 포기 시 세션 자동 종료 판단에 사용됩니다.
   *
   * @param roomCode - 방 코드
   * @returns 활성 멤버 수
   */
  async countActiveMembersInRoom(roomCode: string): Promise<number> {
    return this.roomRepository.countActiveMembers(roomCode);
  }
}
