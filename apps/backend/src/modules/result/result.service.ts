import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    InternalServerErrorException,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../../common/prisma.service';
import { PenaltyService } from '../penalty/penalty.service';

@Injectable()
export class ResultService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly penaltyService: PenaltyService,
    ) {}

    async getResult(roomCode: string, _userId?: string, _guestToken?: string) {
        const room = await this.prisma.room.findUnique({
            where: { code: roomCode },
            include: {
                template: { include: { penalties: true } },
                roomMembers: {
                    include: {
                        result: { include: { penalties: true } },
                    },
                },
            },
        });

        if (!room) throw new NotFoundException('결과를 찾을 수 없습니다.');
        if (room.phase !== 'result')
            throw new ForbiddenException(
                '세션이 종료된 후 결과를 확인할 수 있습니다.',
            );

        // [Fallback] 로그인 멤버 중 ROOM_RESULT 미존재 시 재계산
        const loggedInMembers = room.roomMembers.filter((m) => m.isLoggedIn);
        const hasUnprocessed = loggedInMembers.some((m) => m.result === null);
        if (hasUnprocessed) {
            try {
                await this.penaltyService.calculateAndSave(roomCode);
                return this.getResult(roomCode, _userId, _guestToken);
            } catch (err) {
                Sentry.captureException(err);
                throw new InternalServerErrorException(
                    '결과 데이터를 생성하는 중 오류가 발생했습니다.',
                );
            }
        }

        const totalSessionMs =
            room.startedAt && room.endedAt
                ? room.endedAt.getTime() - room.startedAt.getTime()
                : null;

        const members = room.roomMembers.map((m) => {
            const totalEscapeMs = m.result?.totalEscapeMs ?? 0;
            const revealedPenalties =
                m.result?.penalties
                    .filter((p) => p.isRevealed)
                    .map((p) => ({ content: p.content, count: p.count })) ?? [];
            const penaltyCount = revealedPenalties.reduce(
                (acc, p) => acc + p.count,
                0,
            );

            return {
                memberId: m.id,
                userId: m.userId,
                nickname: m.nickname,
                profileImage: m.profileImage,
                isLoggedIn: m.isLoggedIn,
                rank: 0,
                totalEscapeMs,
                penaltyTier: m.result?.penaltyTier ?? 0,
                isAllClear: totalEscapeMs === 0,
                penaltyCount,
                gaveUpAt: m.gaveUpAt,
                penalties: {
                    totalCount:
                        m.result?.penalties.reduce((acc, p) => acc + p.count, 0) ?? 0,
                    items: revealedPenalties,
                },
            };
        });

        members.sort((a, b) => b.totalEscapeMs - a.totalEscapeMs);
        members.forEach((m, idx) => (m.rank = idx + 1));

        const penaltyMemberCount = members.filter((m) => m.penaltyTier > 0).length;

        return {
            roomCode: room.code,
            roomTitle: room.title,
            totalSessionMs,
            completedRounds: room.template?.rounds ?? null,
            penaltyMemberCount,
            allClear: members.every((m) => m.isAllClear),
            members,
            rule: room.template
                ? {
                    focusMin: room.template.focusMin,
                    breakMin: room.template.breakMin,
                    rounds: room.template.rounds,
                    penalties: room.template.penalties.map((p) => ({
                        itemId: p.id,
                        content: p.content,
                    })),
                    tierConfig: room.template.tierConfig,
                }
                : null,
        };
    }
}
