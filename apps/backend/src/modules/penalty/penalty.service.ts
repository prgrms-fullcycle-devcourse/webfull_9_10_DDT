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

    // 멱등성: 트랜잭션 진입 전 기존 결과 일괄 조회 (N+1 제거)
    const existingResults = await this.prisma.roomResult.findMany({
      where: { roomMemberId: { in: room.roomMembers.map((m) => m.id) } },
      select: { roomMemberId: true },
    });
    const processedIds = new Set(existingResults.map((r) => r.roomMemberId));

    // 세션 종료 기준 시각(미복귀 EscapeLog 마감·포기자 잔여 합산의 공통 anchor).
    // 정상 경로에선 endedAt이 채워져 있다. 누락 시 now()를 쓰면 lazy 산정이 늦을수록
    // 잔여 시간이 과대 합산되므로, '계획된 종료 시각'(시작 + 계획 세션 길이)으로 결정적 대체한다.
    const plannedDurationMs = (focusMin * rounds + breakMin * Math.max(0, rounds - 1)) * 60 * 1000;
    const sessionEndedAt =
      room.endedAt ??
      (room.startedAt
        ? new Date(room.startedAt.getTime() + plannedDurationMs)
        : new Date());

    await this.prisma.$transaction(async (tx) => {
      for (const member of room.roomMembers) {
        if (processedIds.has(member.id)) continue;

        // 미복귀(returnedAt=null) EscapeLog를 endedAt으로 마감 후 합산.
        // domain-rules.md §2 — 세션 종료 시 미복귀 유저 이탈 시간 미집계 방지(어뷰징 차단).
        let totalEscapeMs = 0;
        for (const log of member.escapeLogs) {
          if (log.returnedAt === null) {
            const durationMs = Math.max(
              0,
              sessionEndedAt.getTime() - log.escapedAt.getTime(),
            );
            await tx.escapeLog.update({
              where: { id: log.id },
              data: { returnedAt: sessionEndedAt, durationMs },
            });
            totalEscapeMs += durationMs;
          } else {
            totalEscapeMs += log.durationMs ?? 0;
          }
        }

        // 중도 포기자(탈주): 포기~종료 잔여 시간을 이탈 시간에 합산(UI 표기용). 음수 가드.
        if (member.gaveUpAt) {
          totalEscapeMs += Math.max(
            0,
            sessionEndedAt.getTime() - member.gaveUpAt.getTime(),
          );
        }

        const { penaltyTier, penaltyCount, isForceAll } = member.gaveUpAt
          ? resolveForfeitTier(tiers)
          : calculatePenaltyTier(totalEscapeMs, focusMin, rounds, tiers);

        const existing = await tx.roomResult.findUnique({
          where: { roomMemberId: member.id },
        });

        // 멱등성 + 동시성: 결과 미존재일 때만 생성·배정.
        // upsert(update:{}) 대신 create를 써서, 동시 트랜잭션 충돌 시 roomMemberId PK
        // 위반으로 전체 롤백시켜 벌칙 행 중복 INSERT(remainingSpins 과대)를 차단한다.
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
