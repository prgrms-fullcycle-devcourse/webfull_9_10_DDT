import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  getEffectiveFocusEscapeMs,
  mergeIntervals,
} from '../penalty/penalty.util';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class EscapeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2, // ✅ 이벤트 이미터 주입
  ) {}

  async updateHeartbeat(roomCode: string, identifier: string) {
    await this.redis.instance.set(`heartbeat:${roomCode}:${identifier}`, Date.now().toString(), 'EX', 15);
  }

  async clearHeartbeat(roomCode: string, identifier: string) {
    await this.redis.instance.del(`heartbeat:${roomCode}:${identifier}`);
  }

  async logEscapeStart(roomCode: string, identifier: string) {
    const room = await this.prisma.room.findUnique({ where: { code: roomCode } });
    if (!room || room.phase !== 'timer') return;

    const isGuest = identifier.startsWith('guest_');
    const member = await this.prisma.roomMember.findFirst({
      where: { roomCode, ...(isGuest ? { guestToken: identifier } : { userId: identifier }) },
    });

    if (!member || member.gaveUpAt) return;

    const activeEscape = await this.prisma.escapeLog.findFirst({
      where: { roomMemberId: member.id, returnedAt: null },
    });

    if (!activeEscape) {
      await this.prisma.escapeLog.create({
        data: { roomMemberId: member.id, escapedAt: new Date() },
      });

      // ✅ 직접 호출 대신 이벤트 발행 (순환 참조 원천 차단)
      this.eventEmitter.emit('escape.started', {
        roomCode,
        userId: identifier,
      });
    }
  }

  async logEscapeEnd(roomCode: string, identifier: string) {
    const isGuest = identifier.startsWith('guest_');
    const member = await this.prisma.roomMember.findFirst({
      where: { roomCode, ...(isGuest ? { guestToken: identifier } : { userId: identifier }) },
    });

    if (!member || member.gaveUpAt) return;

    const activeEscape = await this.prisma.escapeLog.findFirst({
      where: { roomMemberId: member.id, returnedAt: null },
    });

    if (activeEscape) {
      const now = new Date();
      const durationMs = now.getTime() - activeEscape.escapedAt.getTime();
      await this.prisma.escapeLog.update({
        where: { id: activeEscape.id },
        data: { returnedAt: now, durationMs },
      });
    }
  }

  async getCurrentSummary(roomCode: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
      include: {
        template: true,
        roomMembers: { include: { escapeLogs: { where: { deletedAt: null } } } },
      },
    });
    if (!room?.template || !room.startedAt) return [];

    const { focusMin, breakMin, rounds } = room.template;
    const sessionStartMs = room.startedAt.getTime();
    const now = Date.now();

    return room.roomMembers.map((member) => {
      const intervals = member.escapeLogs.map((log) => ({
        start: log.escapedAt.getTime(),
        end: log.returnedAt ? log.returnedAt.getTime() : now,
      }));

      const merged = mergeIntervals(intervals);
      let totalEscapeMs = 0;

      for (const { start, end } of merged) {
        totalEscapeMs += getEffectiveFocusEscapeMs(start, end, sessionStartMs, focusMin, breakMin, rounds);
      }
      return { identifier: member.userId ?? member.guestToken, totalEscapeMs };
    });
  }
}