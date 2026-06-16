import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  calculatePenaltyTier,
  getEffectiveFocusEscapeMs,
  parseTierConfig,
  resolveForfeitTier,
} from './penalty.util';
import type { PenaltyItem } from '@prisma/client';

/**
 * 세션 종료·중도 포기 시 멤버별 이탈 시간을 집계해
 * 벌칙 등급과 벌칙 목록을 산정·저장하는 서비스입니다.
 */
@Injectable()
export class PenaltyService {
  constructor(private readonly prisma: PrismaService) {}
  /**
   * 서로 겹치는 이탈 시간 구간을 하나로 병합합니다. (중복 합산 방지)
   *
   * @param {{ start: number; end: number }[]} intervals - 병합할 시간 구간 배열
   * @returns {{ start: number; end: number }[]} 겹침이 제거된 구간 배열
   */
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

  /**
   * 방의 모든 멤버에 대해 이탈 시간을 집계하고 벌칙 등급·목록을 산정·저장합니다.
   * 세션 정상 종료 시 호출되며, 이미 산정된 멤버는 건너뜁니다(포기자는 재산정).
   *
   * @param {string} roomCode - 대상 방 코드
   * @returns {Promise<void>}
   * @throws 방 또는 계약서 정보가 없으면 NotFoundException
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
    if (!room.template) throw new NotFoundException('각서 정보가 없습니다.');

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

    // 탈옥자의 '남은시간'은 실제 종료가 아니라 '예정된 종료'까지로 산정한다.
    // (마지막 인원이 탈옥하면 실제 종료시각이 탈옥시각과 같아져 남은시간이 0이 되는 문제 방지)
    const plannedEndMs =
      (room.startedAt?.getTime() ?? sessionStartMs) + plannedDurationMs;

    // 전체 집중 시간을 계산합니다. (최대치 상한용)
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
            end: plannedEndMs,
          });
        }

        // 1단계: 겹치는 이탈 시간 병합
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

        // 2단계: 총 이탈 시간이 전체 집중 시간을 초과하지 않도록 보정
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

  /**
   * 특정 멤버 한 명의 중도 포기(give-up) 결과를 산정해 저장합니다.
   * 결과가 이미 존재하면 새로 생성하지 않습니다(멱등).
   *
   * @param {string} roomCode - 대상 방 코드
   * @param {string} memberId - 산정할 멤버의 roomMember id
   * @returns {Promise<void>}
   * @throws 방·계약서·멤버 정보가 없으면 NotFoundException
   */
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
    if (!room.template) throw new NotFoundException('각서 정보가 없습니다.');

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

    // 탈옥자의 '남은시간'은 실제 종료가 아니라 '예정된 종료'까지로 산정한다.
    const plannedEndMs =
      (room.startedAt?.getTime() ?? sessionStartMs) + plannedDurationMs;

    // 전체 집중 시간을 계산합니다. (최대치 상한용)
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
          end: plannedEndMs,
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

      // 2단계: 총 이탈 시간이 전체 집중 시간을 초과하지 않도록 보정
      totalEscapeMs = Math.min(totalEscapeMs, totalFocusMsConst);

      const { penaltyTier } = calculatePenaltyTier(
        totalEscapeMs,
        focusMin,
        rounds,
        tiers,
      );
      const { penaltyCount } = resolveForfeitTier(tiers);

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
              isRevealed: false,
            })),
            skipDuplicates: true,
          });
        }
      }
    });
  }

  /**
   * 벌칙 풀에서 지정 개수만큼 무작위로 뽑아 content별 개수로 집계합니다.
   * 매 회 풀 전체에서 독립 추첨(복원추출)하므로 같은 벌칙이 중복될 수 있습니다.
   *
   * @param {PenaltyItem[]} pool - 계약서에 등록된 벌칙 후보 목록
   * @param {number} count - 뽑을 벌칙 개수
   * @returns {Record<string, number>} 벌칙 content → 선택된 횟수 맵
   */
  private assignPenalties(
    pool: PenaltyItem[],
    count: number,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    if (pool.length === 0) return result;

    // 매 회 풀 전체에서 독립 추첨(복원추출) → 같은 벌칙이 중복/편향될 수 있음
    for (let i = 0; i < count; i++) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      result[item.content] = (result[item.content] ?? 0) + 1;
    }
    return result;
  }
}
