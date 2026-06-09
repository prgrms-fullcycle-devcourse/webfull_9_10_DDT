import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  calculatePenaltyTier,
  getEffectiveFocusEscapeMs,
  parseTierConfig,
  resolveForfeitTier,
} from './penalty.util';
import type { PenaltyItem } from '@prisma/client';

@Injectable()
export class PenaltyService {
  constructor(private readonly prisma: PrismaService) {}
  private mergeIntervals(
    intervals: { start: number; end: number }[],
  ): { start: number; end: number }[] {
    if (intervals.length <= 1) return intervals;
    intervals.sort((a, b) => a.start - b.start);

    const merged = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
      const current = intervals[i];
      const last = merged[merged.length - 1];

      if (current.start <= last.end) {
        last.end = Math.max(last.end, current.end);
      } else {
        merged.push(current);
      }
    }
    return merged;
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

    // 💡 전체 집중 시간을 계산합니다. (최대치 상한용)
    const totalFocusMsConst = focusMin * rounds * 60 * 1000;

    await this.prisma.$transaction(async (tx) => {
      for (const member of room.roomMembers) {
        if (processedIds.has(member.id) && !member.gaveUpAt) continue;

        const intervals: { start: number; end: number }[] = [];

        for (const log of member.escapeLogs) {
          const escStart = log.escapedAt.getTime();
          const rawEnd = log.returnedAt
            ? log.returnedAt.getTime()
            : sessionEndedAt.getTime();
          const escEnd = Math.min(rawEnd, sessionEndedAt.getTime());

          const effectiveMs = getEffectiveFocusEscapeMs(
            escStart,
            escEnd,
            sessionStartMs,
            focusMin,
            breakMin,
            rounds,
          );

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

          intervals.push({ start: escStart, end: escEnd });
        }

        if (member.gaveUpAt) {
          intervals.push({
            start: member.gaveUpAt.getTime(),
            end: sessionEndedAt.getTime(),
          });
        }

        // 💡 1단계: 겹치는 이탈 시간 병합
        const mergedIntervals = this.mergeIntervals(intervals);
        let totalEscapeMs = 0;

        for (const interval of mergedIntervals) {
          totalEscapeMs += getEffectiveFocusEscapeMs(
            interval.start,
            interval.end,
            sessionStartMs,
            focusMin,
            breakMin,
            rounds,
          );
        }

        // 💡 2단계: 총 이탈 시간이 전체 집중 시간을 초과하지 않도록 보정
        totalEscapeMs = Math.min(totalEscapeMs, totalFocusMsConst);

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

    // 💡 전체 집중 시간을 계산합니다. (최대치 상한용)
    const totalFocusMsConst = focusMin * rounds * 60 * 1000;

    await this.prisma.$transaction(async (tx) => {
      const intervals: { start: number; end: number }[] = [];

      for (const log of member.escapeLogs) {
        const escStart = log.escapedAt.getTime();
        const escEnd = log.returnedAt
          ? log.returnedAt.getTime()
          : sessionEndedAt.getTime();

        const effectiveMs = getEffectiveFocusEscapeMs(
          escStart,
          escEnd,
          sessionStartMs,
          focusMin,
          breakMin,
          rounds,
        );

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

        intervals.push({ start: escStart, end: escEnd });
      }

      if (member.gaveUpAt) {
        intervals.push({
          start: member.gaveUpAt.getTime(),
          end: sessionEndedAt.getTime(),
        });
      }

      const mergedIntervals = this.mergeIntervals(intervals);
      let totalEscapeMs = 0;

      for (const interval of mergedIntervals) {
        totalEscapeMs += getEffectiveFocusEscapeMs(
          interval.start,
          interval.end,
          sessionStartMs,
          focusMin,
          breakMin,
          rounds,
        );
      }

      // 💡 2단계: 총 이탈 시간이 전체 집중 시간을 초과하지 않도록 보정
      totalEscapeMs = Math.min(totalEscapeMs, totalFocusMsConst);

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
