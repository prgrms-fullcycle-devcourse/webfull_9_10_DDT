import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

/** Redis 방 상태에 저장되는 개별 멤버 정보 */
export interface RoomMember {
  nickname: string;
  isLoggedIn: boolean;
  isHost: boolean;
  connected: boolean;
  profileImage: string;
  socketId?: string;
  isSigned?: boolean;
  canEdit?: boolean;
  /** 중도포기(탈옥) 시각. null이면 정상 참여 중 */
  gaveUpAt?: string | null;
}

/** Redis에 캐싱되는 방의 실시간 상태 */
export interface RoomState {
  roomCode: string;
  hostId: string;
  phase: string;
  members: Record<string, RoomMember>;
}

/** nanoid 코드 중복 시 최대 재시도 횟수 */
const MAX_CODE_RETRIES = 5;

/** Redis 방 상태 TTL (24시간, 초 단위) */
export const ROOM_STATE_TTL = 86400;

/**
 * 방(Room) 관련 DB(Prisma) + Redis 접근을 담당하는 리포지토리.
 * 방 CRUD, 멤버 관리, Redis 실시간 상태 캐싱, 강퇴 목록을 처리합니다.
 */
@Injectable()
export class RoomRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * 방 코드로 방 정보를 조회합니다. (비밀번호 해시, 페이즈, 호스트, 멤버 수 포함)
   * 입장 시 비밀번호 검증 및 정원 확인에 사용됩니다.
   *
   * @param code - 방 코드
   * @returns 방 정보 또는 null
   */
  findByCode(code: string) {
    return this.prisma.room.findUnique({
      where: { code },
      select: {
        code: true,
        passwordHash: true,
        phase: true,
        hostId: true,
        _count: { select: { roomMembers: true } },
      },
    });
  }

  /**
   * 방 코드로 방 정보를 조회합니다. (제목 포함, 비밀번호 해시 미포함)
   * 방 입장 후 화면 표시용으로 사용됩니다.
   *
   * @param code - 방 코드
   * @returns 방 정보 또는 null
   */
  findByCodeWithTitle(code: string) {
    return this.prisma.room.findUnique({
      where: { code },
      select: {
        code: true,
        title: true,
        phase: true,
        hostId: true,
        _count: { select: { roomMembers: true } },
      },
    });
  }

  /**
   * 방 코드로 방 + 세션 템플릿(타이머 설정)을 함께 조회합니다.
   *
   * @param code - 방 코드
   * @returns Room (template 포함) 또는 null
   */
  findByCodeWithTemplate(code: string) {
    return this.prisma.room.findUnique({
      where: { code },
      include: { template: true },
    });
  }

  /**
   * 방의 현재 페이즈와 호스트 ID만 조회합니다. (경량 조회)
   *
   * @param code - 방 코드
   * @returns { phase, hostId } 또는 null
   */
  findPhaseByCode(code: string) {
    return this.prisma.room.findUnique({
      where: { code },
      select: { phase: true, hostId: true },
    });
  }

  /**
   * 호스트가 현재 참여 중인 활성 방을 조회합니다. (closed, result 제외)
   * 중복 방 생성/입장 방지에 사용됩니다.
   *
   * @param hostId - 호스트 userId
   * @returns 활성 방 (roomMembers의 gaveUpAt 포함) 또는 null
   */
  findActiveRoomByHost(hostId: string) {
    return this.prisma.room.findFirst({
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
  }

  /**
   * 로그인 유저가 현재 참여 중인 활성 방을 조회합니다.
   * 중도포기하지 않은 멤버이거나, 호스트이면서 멤버 레코드가 없는 경우를 포함합니다.
   *
   * @param userId - 유저 ID
   * @returns { code, phase, title } 또는 null
   */
  findActiveRoomByUser(userId: string) {
    return this.prisma.room.findFirst({
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

  /**
   * 게스트가 현재 참여 중인 활성 방을 조회합니다.
   * 중도포기한 게스트는 제외됩니다.
   *
   * @param guestToken - 게스트 토큰
   * @returns { code, phase, title } 또는 null
   */
  findActiveRoomByGuest(guestToken: string) {
    return this.prisma.room.findFirst({
      where: {
        phase: { notIn: ['closed', 'result'] },
        roomMembers: { some: { guestToken, gaveUpAt: null } },
      },
      select: { code: true, phase: true, title: true },
    });
  }

  /**
   * 특정 방에서 userId 또는 guestToken으로 멤버를 조회합니다.
   *
   * @param roomCode - 방 코드
   * @param userId - 로그인 유저 ID (게스트면 null)
   * @param guestToken - 게스트 토큰 (로그인 유저면 null)
   * @returns RoomMember 엔티티 또는 null
   */
  findMember(
    roomCode: string,
    userId: string | null,
    guestToken: string | null,
  ) {
    const isGuest = !userId && !!guestToken;
    return this.prisma.roomMember.findFirst({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: guestToken } : { userId: userId! }),
      },
    });
  }

  /**
   * 타이머 진행 중인 방에서 중도포기하지 않은 특정 유저의 멤버 레코드를 조회합니다.
   * 중복 입장 방지 검증에 사용됩니다.
   *
   * @param userId - 유저 ID
   * @returns RoomMember 엔티티 또는 null
   */
  findMemberInTimerRoom(userId: string) {
    return this.prisma.roomMember.findFirst({
      where: { userId, gaveUpAt: null, room: { phase: 'timer' } },
    });
  }

  /**
   * 방에서 중도포기하지 않은 활성 멤버 수를 반환합니다.
   * 마지막 멤버 포기 시 세션 자동 종료 판단에 사용됩니다.
   *
   * @param roomCode - 방 코드
   * @returns 활성 멤버 수
   */
  countActiveMembers(roomCode: string) {
    return this.prisma.roomMember.count({
      where: { roomCode, gaveUpAt: null },
    });
  }

  /**
   * 중복되지 않는 방 코드를 생성하여 방을 DB에 저장합니다.
   * nanoid(8)로 코드를 생성하며, 중복 시 최대 5회 재시도합니다.
   *
   * @param data - 방 생성 데이터 (title, password, maxMembers 등)
   * @returns 생성된 Room 엔티티
   * @throws InternalServerErrorException 5회 재시도 후에도 중복 발생 시
   */
  async createWithUniqueCode(data: {
    title: string;
    hostId: string;
    passwordHash: string;
    phase: string;
  }) {
    for (let i = 0; i < MAX_CODE_RETRIES; i++) {
      const code = nanoid(8);
      try {
        return await this.prisma.room.create({
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

  /**
   * 방의 페이즈를 업데이트합니다. (lobby → contract → timer → result → closed)
   *
   * @param roomCode - 방 코드
   * @param phase - 변경할 페이즈 문자열
   */
  updatePhase(roomCode: string, phase: string) {
    return this.prisma.room.update({
      where: { code: roomCode },
      data: { phase },
    });
  }

  /**
   * 로그인 유저의 멤버 레코드를 upsert합니다.
   * 최초 입장 시 create, 재입장 시 닉네임/프로필 update.
   *
   * @param roomCode - 방 코드
   * @param userId - 유저 ID
   * @param data - 닉네임, 프로필 이미지, 호스트 여부
   */
  upsertUserMember(
    roomCode: string,
    userId: string,
    data: { nickname: string; profileImage: string; isHost: boolean },
  ) {
    return this.prisma.roomMember.upsert({
      where: { roomCode_userId: { roomCode, userId } },
      update: { nickname: data.nickname, profileImage: data.profileImage },
      create: {
        roomCode,
        userId,
        nickname: data.nickname,
        isHost: data.isHost,
        isLoggedIn: true,
        profileImage: data.profileImage,
      },
    });
  }

  /**
   * 게스트 멤버 레코드를 생성합니다.
   * 게스트는 매번 새 토큰이 발급되므로 upsert가 아닌 create입니다.
   *
   * @param roomCode - 방 코드
   * @param guestToken - 게스트 토큰
   * @param data - 닉네임, 프로필 이미지
   */
  createGuestMember(
    roomCode: string,
    guestToken: string,
    data: { nickname: string; profileImage: string },
  ) {
    return this.prisma.roomMember.create({
      data: {
        roomCode,
        guestToken,
        nickname: data.nickname,
        isHost: false,
        isLoggedIn: false,
        profileImage: data.profileImage,
      },
    });
  }

  /**
   * RoomMember ID로 멤버를 삭제합니다. (퇴장 처리)
   *
   * @param id - RoomMember PK
   */
  deleteMemberById(id: string) {
    return this.prisma.roomMember.delete({
      where: { id },
    });
  }

  /**
   * userId 또는 guestToken으로 멤버를 삭제합니다. (강퇴 처리)
   * guest_ 접두사로 게스트 여부를 판별합니다.
   *
   * @param roomCode - 방 코드
   * @param targetId - 삭제할 userId 또는 guestToken
   */
  deleteMember(roomCode: string, targetId: string) {
    const isGuest = targetId.startsWith('guest_');
    return this.prisma.roomMember.deleteMany({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: targetId } : { userId: targetId }),
      },
    });
  }

  /**
   * Redis에서 방 상태를 조회합니다.
   * 방 상태에는 멤버 목록, 서명 상태, 편집 권한 등이 포함됩니다.
   *
   * @param roomCode - 방 코드
   * @returns 방 상태 객체 또는 null (방이 없거나 만료된 경우)
   */
  async getState(roomCode: string): Promise<RoomState | null> {
    const raw = await this.redis.instance.get(`room:state:${roomCode}`);
    return raw ? (JSON.parse(raw) as RoomState) : null;
  }

  /**
   * Redis에 방 상태를 저장합니다. TTL은 ROOM_STATE_TTL(24시간)입니다.
   *
   * @param roomCode - 방 코드
   * @param state - 저장할 방 상태 객체
   */
  async saveState(roomCode: string, state: RoomState): Promise<void> {
    await this.redis.instance.set(
      `room:state:${roomCode}`,
      JSON.stringify(state),
      'EX',
      ROOM_STATE_TTL,
    );
  }

  /**
   * Redis에서 방 상태를 삭제합니다. (방 폭파 시)
   *
   * @param roomCode - 방 코드
   */
  async deleteState(roomCode: string): Promise<void> {
    await this.redis.instance.del(`room:state:${roomCode}`);
  }

  /**
   * 특정 멤버가 방에서 강퇴(ban) 상태인지 확인합니다.
   *
   * @param roomCode - 방 코드
   * @param targetId - 확인할 userId 또는 guestToken
   * @returns 강퇴 상태이면 true
   */
  async isBanned(roomCode: string, targetId: string): Promise<boolean> {
    const result = await this.redis.instance.get(
      `room:ban:${roomCode}:${targetId}`,
    );
    return !!result;
  }

  /**
   * 특정 멤버를 강퇴 목록에 등록합니다.
   * TTL은 방 상태와 동일(24시간)하며, 재입장 시 isBanned()로 차단됩니다.
   *
   * @param roomCode - 방 코드
   * @param targetId - 강퇴할 userId 또는 guestToken
   */
  async setBan(roomCode: string, targetId: string): Promise<void> {
    await this.redis.instance.set(
      `room:ban:${roomCode}:${targetId}`,
      '1',
      'EX',
      ROOM_STATE_TTL,
    );
  }
}
