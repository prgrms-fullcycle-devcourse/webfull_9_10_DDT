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

  async logEscapeStart(roomCode: string, identifier: string) {
    const room = await this.prisma.room.findUnique({ where: { code: roomCode } });
    if (!room || room.phase !== 'timer') return;

    const isGuest = identifier.startsWith('guest_');
    const member = await this.prisma.roomMember.findFirst({
      where: { 
        roomCode, 
        ...(isGuest ? { guestToken: identifier } : { userId: identifier })
      },
    });

    if (!member) return;

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
        ...(isGuest ? { guestToken: identifier } : { userId: identifier })
      },
    });

    if (!member) return;

    const activeEscape = await this.prisma.escapeLog.findFirst({
      where: { roomMemberId: member.id, returnedAt: null },
      orderBy: { escapedAt: 'desc' },
    });

    if (activeEscape) {
      const returnedAt = new Date();
      const durationMs = returnedAt.getTime() - activeEscape.escapedAt.getTime();

      await this.prisma.$transaction([
        this.prisma.escapeLog.update({
          where: { id: activeEscape.id },
          data: { returnedAt, durationMs },
        }),
        this.prisma.roomResult.update({
          where: { roomMemberId: member.id },
          data: { totalEscapeMs: { increment: durationMs } },
        }),
      ]);
    }
  }
}