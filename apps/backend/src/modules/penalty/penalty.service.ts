import { Injectable, NotFoundException } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../../common/prisma.service';
import { calculatePenaltyTier, parseTierConfig } from './penalty.util';
import type { PenaltyItem } from '@prisma/client';

@Injectable()
export class PenaltyService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * 세션 종료 시점에 호출. 로그인 멤버 전원의 벌칙 산정 후 DB 저장.
     * 멱등성 보장: 기존 ROOM_RESULT 존재 시 skip.
     */
    async calculateAndSave(roomCode: string): Promise<void> {
        const room = await this.prisma.room.findUnique({
            where: { code: roomCode },
            include: {
                template: { include: { penalties: true } },
                roomMembers: {
                    where: { isLoggedIn: true },
                    include: { escapeLogs: { where: { deletedAt: null } } },
                },
            },
        });

        if (!room) throw new NotFoundException('방을 찾을 수 없습니다.');
        if (!room.template) throw new NotFoundException('계약서 정보가 없습니다.');

        const tiers = parseTierConfig(room.template.tierConfig);
        const { focusMin, rounds } = room.template;
        const penaltyPool = room.template.penalties;

        await this.prisma.$transaction(async (tx) => {
            for (const member of room.roomMembers) {
                // 멱등성: 이미 결과 존재 시 skip
                const existing = await tx.roomResult.findUnique({
                    where: { roomMemberId: member.id },
                });
                if (existing) continue;

                const totalEscapeMs = member.escapeLogs.reduce(
                    (acc, log) => acc + (log.durationMs ?? 0),
                    0,
                );

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
                    });
                }
            }
        });
    }

    /**
     * penaltyCount만큼 pool에서 무작위 배정.
     * pool 크기 초과 시 순환 배정, 동일 content는 count++.
     */
    private assignPenalties(
        pool: PenaltyItem[],
        count: number,
    ): Record<string, number> {
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const result: Record<string, number> = {};
        for (let i = 0; i < count; i++) {
            const item = shuffled[i % shuffled.length];
            result[item.content] = (result[item.content] ?? 0) + 1;
        }
        return result;
    }
}
