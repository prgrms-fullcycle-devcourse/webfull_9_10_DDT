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
   * 세션 종료 시점에 호출. 멤버 전원의 벌칙 산정 후 DB 저장.
   * - 일반 멤버: 결과 미존재일 때만 생성(멱등 skip).
   * - 중도포기자: 포기 시점 '계획 anchor' 임시 산정을 '실제 종료 anchor'로 재산정
   *   (totalEscapeMs·penaltyTier만 update, 벌칙 행은 보존). 등급=시간기반, 개수=최대.
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
        // give-up 멤버는 포기 시점에 '계획 anchor'로 임시 산정됨 → 종료 시 '실제 anchor'로 재산정.
        // 그 외 이미 산정된 멤버는 멱등 skip.
        if (processedIds.has(member.id) && !member.gaveUpAt) continue;

        let totalEscapeMs = 0;

        // 일반 이탈 로그 합산 (휴식 시간 제외 필터링)
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
            rounds,
          );
          totalEscapeMs += giveUpMs;
        }

        const existing = await tx.roomResult.findUnique({
          where: { roomMemberId: member.id },
        });

        // 중도포기자: 등급 배지=이탈시간 기반, 벌칙 개수=항상 최대(최고등급 count), 즉시 전체공개.
        if (member.gaveUpAt) {
          const { penaltyTier } = calculatePenaltyTier(
            totalEscapeMs,
            focusMin,
            rounds,
            tiers,
          );

          if (existing) {
            // 실제 종료 anchor로 재산정: 이탈시간·등급만 갱신.
            // 벌칙 행(개수=최대)은 포기 시점 배정분을 재롤링 없이 보존.
            await tx.roomResult.update({
              where: { roomMemberId: member.id },
              data: { totalEscapeMs, penaltyTier },
            });
          } else {
            // 포기 시점 임시 산정이 실패했던 경우 → 전체 생성(개수=최대, 즉시공개).
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

        // 일반 멤버: 등급/개수 모두 이탈시간 기반. 결과 미존재일 때만 생성.
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
   * 중도포기 시점에 호출. 해당 멤버 단독 벌칙 '임시' 산정·저장 (is_revealed=true 즉시 전체공개).
   * 등급 배지=이탈 누적시간 기반(calculatePenaltyTier), 벌칙 개수=항상 최대(최고등급 count).
   * ⚠️ 포기 시점엔 endedAt이 없어 '계획 anchor'로 산정 → 세션 종료 시 calculateAndSave가
   *    '실제 anchor'로 재산정(조기 종료 시 totalEscapeMs·등급 보정). 벌칙 개수(최대)는 불변.
   * (calculateAndSave 인라인 루프와 의도적으로 동일 형태 유지 — develop 산정 로직 보존)
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
    if (!room.template) throw new NotFoundException('계약서 정보가 없습니다.');

    const member = room.roomMembers[0];
    if (!member)
      throw new NotFoundException('방 참여 정보를 찾을 수 없습니다.');

    const tiers = parseTierConfig(room.template.tierConfig);
    const { focusMin, breakMin, rounds } = room.template;
    const penaltyPool = room.template.penalties;

    // give-up 시점엔 endedAt이 없으므로 계획 종료 시각을 anchor로 사용 (calculateAndSave와 동일 공식).
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

      // 일반 이탈 로그 합산 (휴식 시간 제외 필터링)
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

      // 포기 시각 ~ 세션 종료 잔여 집중 시간 합산 (휴식 시간 제외).
      // [불변식] 호출부(timer.giveUp)가 열린 로그를 gaveUpAt으로 먼저 마감하므로,
      // 위 로그 구간(≤gaveUpAt)과 아래 잔여 구간(≥gaveUpAt)은 겹치지 않는다(이중합산 불가).
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

      // 등급 배지: 이탈 누적시간 기반(최고등급 자동부여 폐지).
      // 벌칙 개수: 항상 최대치(최고등급 count) — 중도포기 정책, 예외 없음.
      // is_revealed=true 즉시 전체공개(포기자는 룰렛 미진행).
      // ⚠️ 포기 시점은 '계획 anchor' 기반 임시 산정 — 세션 종료 시 calculateAndSave가 실제 anchor로 재산정.
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

  /**
   * penaltyCount만큼 pool에서 무작위 배정.
   * pool 크기 초과 시 순환 배정, 동일 content는 count++.
   * Fisher-Yates 셔플 적용.
   */
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
