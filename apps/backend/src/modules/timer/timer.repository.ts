import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

const ROOM_STATE_TTL = 86400;

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

  async giveUpTransaction(memberId: string, now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.closeOpenEscapeLogs(memberId, now, tx);
      await this.updateMemberGaveUp(memberId, now, tx);
    });
  }
}
