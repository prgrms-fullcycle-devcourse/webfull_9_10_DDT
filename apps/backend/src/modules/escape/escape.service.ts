import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { PushNotificationService } from '../timer/push-notification.service';
import {
  getEffectiveFocusEscapeMs,
  mergeIntervals,
} from '../penalty/penalty.util';

@Injectable()
export class EscapeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    // 💡 PushNotificationService 주입 (순환 참조 방지)
    @Inject(forwardRef(() => PushNotificationService))
    private readonly pushService: PushNotificationService,
  ) {}

  async updateHeartbeat(roomCode: string, identifier: string) {
    await this.redis.instance.set(
      `heartbeat:${roomCode}:${identifier}`,
      Date.now().toString(),
      'EX',
      15,
    );
  }

  // 💡 소켓이 정상적으로 끊어졌을 때 Heartbeat 키를 삭제하는 로직
  async clearHeartbeat(roomCode: string, identifier: string) {
    await this.redis.instance.del(`heartbeat:${roomCode}:${identifier}`);
  }

  async logEscapeStart(roomCode: string, identifier: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
    });
    if (!room || room.phase !== 'timer') return;

    const isGuest = identifier.startsWith('guest_');
    const member = await this.prisma.roomMember.findFirst({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: identifier } : { userId: identifier }),
      },
    });

    if (!member || member.gaveUpAt) return;

    const activeEscape = await this.prisma.escapeLog.findFirst({
      where: { roomMemberId: member.id, returnedAt: null },
    });

    // 활성화된 이탈 기록이 없을 때만 새로 생성
    if (!activeEscape) {
      await this.prisma.escapeLog.create({
        data: {
          roomMemberId: member.id,
          escapedAt: new Date(),
        },
      });

      // 💡 푸시 알림 발송 (이탈이 시작되는 순간 본인에게만 전송)
      this.pushService
        .sendToUser(
          roomCode,
          identifier,
          '🚨 화면 이탈 감지!',
          '집중 화면을 벗어났습니다. 이탈 시간이 누적되고 있어요!',
        )
        .catch((e) => console.error('이탈 푸시 에러:', e));
    }
  }

  async logEscapeEnd(roomCode: string, identifier: string) {
    const isGuest = identifier.startsWith('guest_');
    const member = await this.prisma.roomMember.findFirst({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: identifier } : { userId: identifier }),
      },
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
        data: {
          returnedAt: now,
          durationMs,
        },
      });
    }
  }

  async getCurrentSummary(roomCode: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
      include: {
        template: true,
        roomMembers: {
          include: { escapeLogs: { where: { deletedAt: null } } },
        },
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
        totalEscapeMs += getEffectiveFocusEscapeMs(
          start,
          end,
          sessionStartMs,
          focusMin,
          breakMin,
          rounds,
        );
      }
      return { identifier: member.userId ?? member.guestToken, totalEscapeMs };
    });
  }
}
