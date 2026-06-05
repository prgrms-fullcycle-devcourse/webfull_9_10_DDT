import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  calculatePenaltyTier,
  parseTierConfig,
  resolveForfeitTier,
} from './penalty.util';
import type { PenaltyItem } from '@prisma/client';

@Injectable()
export class PenaltyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 이탈 기간 [escapedAt, returnedAt] 중 실제 '집중 시간'에 포함되는 시간(ms)만 추출
   */
  private getEffectiveFocusEscapeMs(
    escapedAtMs: number,
    returnedAtMs: number,
    sessionStartMs: number,
    focusMin: number,
    breakMin: number,
    rounds: number,
  ): number {
    let overlapMs = 0;
    const cycleMs = (focusMin + breakMin) * 60 * 1000;
    const focusMs = focusMin * 60 * 1000;

    for (let i = 0; i < rounds; i++) {
      const focusStart = sessionStartMs + i * cycleMs;
      const focusEnd = focusStart + focusMs;

      const overlapStart = Math.max(escapedAtMs, focusStart);
      const overlapEnd = Math.min(returnedAtMs, focusEnd);

      if (overlapStart < overlapEnd) {
        overlapMs += overlapEnd - overlapStart;
      }
    }
    return overlapMs;
  }

  async calculateAndSave(roomCode: string): Promise<void> {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
      include: {
        template: { include: { penalties: true } },
        roomMembers: {
          include: { escapeLogs: { where: { deletedAt: null } } },
        },
      },
    });

    if (!room) throw new NotFoundException('방을 찾을 수 없습니다.');
    if (!room.template) throw new NotFoundException('계약서 정보가 없습니다.');

    const tiers = parseTierConfig(room.template.tierConfig);
    const { focusMin, breakMin, rounds } = room.template;
    const penaltyPool = room.template.penalties;

    const existingResults = await this.prisma.roomResult.findMany({
      where: { roomMemberId: { in: room.roomMembers.map((m) => m.id) } },
      select: { roomMemberId: true },
    });
    const processedIds = new Set(existingResults.map((r) => r.roomMemberId));

    const plannedDurationMs =
      (focusMin * rounds + breakMin * Math.max(0, rounds - 1)) * 60 * 1000;

    const sessionEndedAt =
      room.endedAt ??
      (room.startedAt
        ? new Date(room.startedAt.getTime() + plannedDurationMs)
        : new Date());

    const sessionStartMs = room.startedAt?.getTime() ?? Date.now();

    await this.prisma.$transaction(async (tx) => {
      for (const member of room.roomMembers) {
        if (processedIds.has(member.id)) continue;

        let totalEscapeMs = 0;

        for (const log of member.escapeLogs) {
          const escStart = log.escapedAt.getTime();
          const rawEnd = log.returnedAt
            ? log.returnedAt.getTime()
            : sessionEndedAt.getTime();
          // 혹시 모를 오차를 위해 세션 종료 시간을 넘지 않도록 제한
          const escEnd = Math.min(rawEnd, sessionEndedAt.getTime());

          const effectiveMs = this.getEffectiveFocusEscapeMs(
            escStart,
            escEnd,
            sessionStartMs,
            focusMin,
            breakMin,
            rounds,
          );

          totalEscapeMs += effectiveMs;

          if (log.returnedAt === null) {
            await tx.escapeLog.update({
              where: { id: log.id },
              data: { returnedAt: sessionEndedAt, durationMs: effectiveMs },
            });
          } else if (log.durationMs !== effectiveMs) {
            await tx.escapeLog.update({
              where: { id: log.id },
              data: { durationMs: effectiveMs },
            });
          }
        }

        if (member.gaveUpAt) {
          const giveUpMs = this.getEffectiveFocusEscapeMs(
            member.gaveUpAt.getTime(),
            sessionEndedAt.getTime(),
            sessionStartMs,
            focusMin,
            breakMin,
            rounds,
          );
          totalEscapeMs += giveUpMs;
        }

        const { penaltyTier, penaltyCount, isForceAll } = member.gaveUpAt
          ? resolveForfeitTier(tiers)
          : calculatePenaltyTier(totalEscapeMs, focusMin, rounds, tiers);

        const existing = await tx.roomResult.findUnique({
          where: { roomMemberId: member.id },
        });

        if (!existing) {
          await tx.roomResult.create({
            data: {
              roomMemberId: member.id,
              roomCode,
              totalEscapeMs,
              penaltyTier,
            },
          });

          if (penaltyCount > 0 && penaltyPool.length > 0) {
            const assigned = this.assignPenalties(penaltyPool, penaltyCount);
            await tx.resultPenalty.createMany({
              data: Object.entries(assigned).map(([content, count]) => ({
                roomMemberId: member.id,
                content,
                count,
                isRevealed: isForceAll,
              })),
              skipDuplicates: true,
            });
          }
        }
      }
    });
  }

  private assignPenalties(
    pool: PenaltyItem[],
    count: number,
  ): Record<string, number> {
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const result: Record<string, number> = {};
    for (let i = 0; i < count; i++) {
      const item = shuffled[i % shuffled.length];
      result[item.content] = (result[item.content] ?? 0) + 1;
    }
    return result;
  }
}
