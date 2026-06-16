import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

const ROOM_STATE_TTL = 86400;

/**
 * 타이머 관련 DB(Prisma) + Redis 접근을 담당하는 리포지토리.
 */
@Injectable()
export class TimerRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * 방 코드로 호스트 검증용 정보를 조회합니다. (code, hostId, phase)
   *
   * @param roomCode - 방 코드
   * @returns 방 정보 또는 null
   */
  findRoomForVerify(roomCode: string) {
    return this.prisma.room.findUnique({
      where: { code: roomCode },
      select: { code: true, hostId: true, phase: true },
    });
  }

  /**
   * 방 + 세션 템플릿을 함께 조회합니다.
   * 타이머 시작 시 focusMin, breakMin, rounds 등 설정값 참조에 사용됩니다.
   *
   * @param roomCode - 방 코드
   * @returns Room (template 포함) 또는 null
   */
  findRoomWithTemplate(roomCode: string) {
    return this.prisma.room.findUnique({
      where: { code: roomCode },
      include: { template: true },
    });
  }

  /**
   * 방의 현재 페이즈만 조회합니다. (경량 조회)
   * BullMQ 잡 실행 전 방 상태 확인에 사용됩니다.
   *
   * @param roomCode - 방 코드
   * @returns { phase } 또는 null
   */

  findRoomPhase(roomCode: string) {
    return this.prisma.room.findUnique({
      where: { code: roomCode },
      select: { phase: true },
    });
  }

  /**
   * 방의 라운드 수만 조회합니다.
   * cancelSessionJobs에서 잡 ID 생성 시 라운드 범위를 결정하는 데 사용됩니다.
   *
   * @param roomCode - 방 코드
   * @returns { template: { rounds } } 또는 null
   */
  findRoomRounds(roomCode: string) {
    return this.prisma.room.findUnique({
      where: { code: roomCode },
      select: { template: { select: { rounds: true } } },
    });
  }

  /**
   * 현재 timer 페이즈인 모든 방을 조회합니다.
   * 서버 재시작 시 onModuleInit에서 BullMQ 잡 복구에 사용됩니다.
   *
   * @returns timer 페이즈 방 목록 (code, startedAt, template)
   */
  findTimerRooms() {
    return this.prisma.room.findMany({
      where: { phase: 'timer' },
      select: {
        code: true,
        startedAt: true,
        template: {
          select: { focusMin: true, breakMin: true, rounds: true },
        },
      },
    });
  }

  /**
   * 방 페이즈를 timer로 전환하고 세션 시작 시각을 기록합니다.
   *
   * @param roomCode - 방 코드
   * @param now - 세션 시작 시각
   */
  updateRoomSessionStart(roomCode: string, now: Date) {
    return this.prisma.room.update({
      where: { code: roomCode },
      data: { phase: 'timer', startedAt: now },
    });
  }

  /**
   * 방 페이즈를 result로 전환하고 세션 종료 시각을 기록합니다.
   *
   * @param roomCode - 방 코드
   * @param now - 세션 종료 시각
   */
  updateRoomSessionEnd(roomCode: string, now: Date) {
    return this.prisma.room.update({
      where: { code: roomCode },
      data: { phase: 'result', endedAt: now },
    });
  }

  /**
   * 중도포기 처리를 위한 멤버 조회. 방의 현재 페이즈를 함께 포함합니다.
   * gaveUpAt 중복 체크 및 페이즈 검증에 사용됩니다.
   *
   * @param roomCode - 방 코드
   * @param userId - 유저 ID 또는 게스트 토큰
   * @param isGuest - 게스트 여부
   * @returns RoomMember (room.phase 포함) 또는 null
   */
  findMemberForGiveUp(roomCode: string, userId: string, isGuest: boolean) {
    return this.prisma.roomMember.findFirst({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: userId } : { userId }),
      },
      include: { room: { select: { phase: true } } },
    });
  }

  /**
   * 멤버의 gaveUpAt을 현재 시각으로 설정합니다.
   * 트랜잭션 내에서 호출될 수 있도록 tx 파라미터를 지원합니다.
   *
   * @param memberId - RoomMember ID
   * @param now - 포기 시각
   * @param tx - Prisma 트랜잭션 클라이언트 (선택)
   */
  updateMemberGaveUp(
    memberId: string,
    now: Date,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    return client.roomMember.update({
      where: { id: memberId },
      data: { gaveUpAt: now },
    });
  }

  /**
   * 특정 멤버의 열린 이탈 로그(returnedAt이 null)를 모두 종료합니다.
   * 중도포기 시 미닫힌 이탈 기록의 durationMs를 확정합니다.
   *
   * @param roomMemberId - RoomMember ID
   * @param closedAt - 이탈 로그 종료 시각
   * @param tx - Prisma 트랜잭션 클라이언트 (선택)
   */
  async closeOpenEscapeLogs(
    roomMemberId: string,
    closedAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const openLogs = await client.escapeLog.findMany({
      where: { roomMemberId, returnedAt: null, deletedAt: null },
      select: { id: true, escapedAt: true },
    });
    await Promise.all(
      openLogs.map((log) =>
        client.escapeLog.update({
          where: { id: log.id },
          data: {
            returnedAt: closedAt,
            durationMs: closedAt.getTime() - log.escapedAt.getTime(),
          },
        }),
      ),
    );
  }

  /**
   * Redis에서 방 상태 원본(JSON 문자열)을 조회합니다.
   * 파싱 없이 raw 데이터가 필요한 경우(push 전송 등)에 사용됩니다.
   *
   * @param roomCode - 방 코드
   * @returns JSON 문자열 또는 null
   */
  getRoomStateRaw(roomCode: string) {
    return this.redis.instance.get(`room:state:${roomCode}`);
  }

  /**
   * 중도포기 상태를 Redis에 반영합니다. (state.members[userId].gaveUpAt 설정)
   *
   * @param roomCode - 방 코드
   * @param userId - 포기한 유저 ID
   * @param gaveUpAt - 포기 시각 (ISO 문자열)
   */
  async saveGiveUpState(
    roomCode: string,
    userId: string,
    gaveUpAt: string,
  ): Promise<void> {
    const raw = await this.redis.instance.get(`room:state:${roomCode}`);
    if (!raw) return;

    const state = JSON.parse(raw) as {
      members: Record<string, { gaveUpAt?: string | null }>;
    };

    if (state.members[userId]) {
      state.members[userId].gaveUpAt = gaveUpAt;
      await this.redis.instance.set(
        `room:state:${roomCode}`,
        JSON.stringify(state),
        'EX',
        ROOM_STATE_TTL,
      );
    }
  }

  /**
   * 푸시 구독 정보를 Redis에 저장합니다.
   * 키 형식: push_sub:{roomCode}:{userId}, TTL은 세션 TTL과 동일합니다.
   *
   * @param roomCode - 방 코드
   * @param userId - 유저 ID
   * @param subscription - JSON 직렬화된 구독 데이터 ({platform, data})
   * @param ttlSec - TTL (초)
   */
  savePushSubscription(
    roomCode: string,
    userId: string,
    subscription: string,
    ttlSec: number,
  ) {
    return this.redis.instance.set(
      `push_sub:${roomCode}:${userId}`,
      subscription,
      'EX',
      ttlSec,
    );
  }

  /**
   * Redis에서 푸시 구독 정보를 조회합니다.
   *
   * @param roomCode - 방 코드
   * @param userId - 유저 ID
   * @returns JSON 직렬화된 구독 데이터 또는 null
   */
  getPushSubscription(roomCode: string, userId: string) {
    return this.redis.instance.get(`push_sub:${roomCode}:${userId}`);
  }

  /**
   * 중도포기 시 DB 트랜잭션: gaveUpAt 설정 + 열린 이탈 로그 종료.
   *
   * @param memberId - RoomMember ID
   * @param now - 포기 시각
   */
  async giveUpTransaction(memberId: string, now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.closeOpenEscapeLogs(memberId, now, tx);
      await this.updateMemberGaveUp(memberId, now, tx);
    });
  }

  /**
   * 특정 멤버의 미공개 벌칙을 전부 isRevealed: true로 업데이트합니다.
   * 이미 전부 공개된 경우 count: 0을 반환합니다 (멱등).
   *
   * @param memberId - RoomMember ID
   * @returns { count } 업데이트된 레코드 수
   */
  async revealUnrevealedPenalties(
    memberId: string,
  ): Promise<{ count: number }> {
    return this.prisma.resultPenalty.updateMany({
      where: { roomMemberId: memberId, isRevealed: false },
      data: { isRevealed: true },
    });
  }

  /**
   * 방의 모든 멤버 ID 목록을 반환합니다.
   * scheduleRevealJobs에서 멤버별 자동공개 잡을 등록할 때 사용합니다.
   *
   * @param roomCode - 방 코드
   * @returns RoomMember ID 배열
   */
  async findRoomMemberIds(roomCode: string): Promise<string[]> {
    const members = await this.prisma.roomMember.findMany({
      where: { roomCode },
      select: { id: true },
    });
    return members.map((m) => m.id);
  }
}
