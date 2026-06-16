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

  findRoomForVerify(roomCode: string) {
    return this.prisma.room.findUnique({
      where: { code: roomCode },
      select: { code: true, hostId: true, phase: true },
    });
  }

  findRoomWithTemplate(roomCode: string) {
    return this.prisma.room.findUnique({
      where: { code: roomCode },
      include: { template: true },
    });
  }

  findRoomPhase(roomCode: string) {
    return this.prisma.room.findUnique({
      where: { code: roomCode },
      select: { phase: true },
    });
  }

  findRoomRounds(roomCode: string) {
    return this.prisma.room.findUnique({
      where: { code: roomCode },
      select: { template: { select: { rounds: true } } },
    });
  }

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

  updateRoomSessionStart(roomCode: string, now: Date) {
    return this.prisma.room.update({
      where: { code: roomCode },
      data: { phase: 'timer', startedAt: now },
    });
  }

  updateRoomSessionEnd(roomCode: string, now: Date) {
    return this.prisma.room.update({
      where: { code: roomCode },
      data: { phase: 'result', endedAt: now },
    });
  }

  findMemberForGiveUp(roomCode: string, userId: string, isGuest: boolean) {
    return this.prisma.roomMember.findFirst({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: userId } : { userId }),
      },
      include: { room: { select: { phase: true } } },
    });
  }

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
