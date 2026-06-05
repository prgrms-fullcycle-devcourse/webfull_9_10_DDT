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
   * 💡 이탈 기간 [escapedAt, returnedAt] 중 실제 '집중 시간'에 포함되는 시간(ms)만 추출
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

      // 해당 라운드의 집중 시간과 이탈 시간의 교집합 구간 찾기
      const overlapStart = Math.max(escapedAtMs, focusStart);
      const overlapEnd = Math.min(returnedAtMs, focusEnd);

      // 겹치는 구간이 존재하면 합산
      if (overlapStart < overlapEnd) {
        overlapMs += overlapEnd - overlapStart;
      }
    }
    return overlapMs;
  }

  /**
   * 세션 종료 시점에 호출. 로그인 멤버 전원의 벌칙 산정 후 DB 저장.
   * 멱등성 보장: 트랜잭션 진입 전 기존 결과 일괄 조회 후 skip.
   */
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

        // 일반 이탈 로그 합산 (휴식 시간 제외 필터링)
        for (const log of member.escapeLogs) {
          const escStart = log.escapedAt.getTime();
          const escEnd = log.returnedAt ? log.returnedAt.getTime() : sessionEndedAt.getTime();
          
          const effectiveMs = this.getEffectiveFocusEscapeMs(
            escStart,
            escEnd,
            sessionStartMs,
            focusMin,
            breakMin,
            rounds
          );

          totalEscapeMs += effectiveMs;

          // DB에 로그를 마감하거나 갱신할 때도 실제 집중 시간 이탈분만 기록
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

        // 중도 포기자 잔여 시간 합산 (휴식 시간 제외 필터링)
        if (member.gaveUpAt) {
          const giveUpMs = this.getEffectiveFocusEscapeMs(
            member.gaveUpAt.getTime(),
            sessionEndedAt.getTime(),
            sessionStartMs,
            focusMin,
            breakMin,
            rounds
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