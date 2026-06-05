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
        // give-up 멤버는 실제 anchor로 재산정, 나머지 기산정 멤버는 skip.
        if (processedIds.has(member.id) && !member.gaveUpAt) continue;

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

        const existing = await tx.roomResult.findUnique({
          where: { roomMemberId: member.id },
        });

        if (member.gaveUpAt) {
          const { penaltyTier } = calculatePenaltyTier(
            totalEscapeMs,
            focusMin,
            rounds,
            tiers,
          );

          if (existing) {
            // 이탈시간·등급만 갱신, 벌칙 행은 보존.
            await tx.roomResult.update({
              where: { roomMemberId: member.id },
              data: { totalEscapeMs, penaltyTier },
            });
          } else {
            const { penaltyCount, isForceAll } = resolveForfeitTier(tiers);
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
          continue;
        }

        if (!existing) {
          const { penaltyTier, penaltyCount, isForceAll } =
            calculatePenaltyTier(totalEscapeMs, focusMin, rounds, tiers);
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

  /** 포기 시점 단독 벌칙 임시 산정·저장. 등급=이탈시간 기반, 개수=최대, 즉시 전체공개. */
  async calculateAndSaveForGiveUp(
    roomCode: string,
    memberId: string,
  ): Promise<void> {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
      include: {
        template: { include: { penalties: true } },
        roomMembers: {
          where: { id: memberId },
          include: { escapeLogs: { where: { deletedAt: null } } },
        },
      },
    });

    if (!room) throw new NotFoundException('방을 찾을 수 없습니다.');
    if (!room.template) throw new NotFoundException('계약서 정보가 없습니다.');

    const member = room.roomMembers[0];
    if (!member)
      throw new NotFoundException('방 참여 정보를 찾을 수 없습니다.');

    const tiers = parseTierConfig(room.template.tierConfig);
    const { focusMin, breakMin, rounds } = room.template;
    const penaltyPool = room.template.penalties;

    const plannedDurationMs =
      (focusMin * rounds + breakMin * Math.max(0, rounds - 1)) * 60 * 1000;

    const sessionEndedAt =
      room.endedAt ??
      (room.startedAt
        ? new Date(room.startedAt.getTime() + plannedDurationMs)
        : new Date());

    const sessionStartMs = room.startedAt?.getTime() ?? Date.now();

    await this.prisma.$transaction(async (tx) => {
      let totalEscapeMs = 0;

      for (const log of member.escapeLogs) {
        const escStart = log.escapedAt.getTime();
        const escEnd = log.returnedAt
          ? log.returnedAt.getTime()
          : sessionEndedAt.getTime();

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

      // timer.giveUp이 열린 로그를 gaveUpAt으로 마감하므로 위 구간과 이중합산 없음.
      if (member.gaveUpAt) {
        totalEscapeMs += this.getEffectiveFocusEscapeMs(
          member.gaveUpAt.getTime(),
          sessionEndedAt.getTime(),
          sessionStartMs,
          focusMin,
          breakMin,
          rounds,
        );
      }

      const { penaltyTier } = calculatePenaltyTier(
        totalEscapeMs,
        focusMin,
        rounds,
        tiers,
      );
      const { penaltyCount } = resolveForfeitTier(tiers);
      const isForceAll = true;

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
    });
  }

  /** Fisher-Yates 셔플 후 penaltyCount만큼 순환 배정. */
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
