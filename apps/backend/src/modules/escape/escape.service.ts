import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class EscapeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async updateHeartbeat(roomCode: string, identifier: string) {
    await this.redis.instance.set(
      `heartbeat:${roomCode}:${identifier}`,
      Date.now().toString(),
      'EX',
      10,
    );
  }

  // 💡 소켓이 정상적으로 끊어졌을 때 Heartbeat 키를 삭제하는 로직 추가
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

    if (!activeEscape) {
      await this.prisma.escapeLog.create({
        data: {
          roomMemberId: member.id,
          escapedAt: new Date(),
        },
      });
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
}
