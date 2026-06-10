import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../../common/prisma.service';
import { PenaltyService } from '../penalty/penalty.service';
import { RoomGateway } from '../gateway/room/room.gateway';
import type { Prisma } from '@prisma/client';

type RoomWithDetails = NonNullable<
  Prisma.RoomGetPayload<{
    include: {
      template: { include: { penalties: true } };
      roomMembers: {
        include: {
          result: { include: { penalties: true } };
        };
      };
    };
  }>
>;

// 결과/룰렛 체류 제한 시간. 화면상 10분으로 임시 지정
export const ROULETTE_TIMEOUT_MS = 10 * 60 * 1000;

@Injectable()
export class ResultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly penaltyService: PenaltyService,
    private readonly roomGateway: RoomGateway,
  ) {}

  private async fetchRoom(roomCode: string) {
    return this.prisma.room.findUnique({
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
  }

  private buildResponse(room: RoomWithDetails) {
    const totalSessionMs =
      room.startedAt && room.endedAt
        ? room.endedAt.getTime() - room.startedAt.getTime()
        : null;

    const now = new Date();
    // rouletteAnchor = endedAt. 기준 변경 시 이 한 줄만 교체.
    const rouletteAnchor = room.endedAt;
    const rouletteEndsAt = rouletteAnchor
      ? new Date(rouletteAnchor.getTime() + ROULETTE_TIMEOUT_MS)
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
      // 남은 룰렛 스핀 수 = 미공개 행들의 count 합산 (중복 포함)
      const remainingSpins =
        m.result?.penalties
          .filter((p) => !p.isRevealed)
          .reduce((acc, p) => acc + p.count, 0) ?? 0;

      return {
        memberId: m.id,
        userId: m.userId,
        guestToken: m.guestToken,
        nickname: m.nickname,
        profileImage: m.profileImage,
        isHost: m.isHost,
        isLoggedIn: m.isLoggedIn,
        rank: 0,
        totalEscapeMs,
        penaltyTier: m.result?.penaltyTier ?? 0,
        isAllClear: totalEscapeMs === 0,
        penaltyCount,
        remainingSpins,
        gaveUpAt: m.gaveUpAt,
        penalties: {
          totalCount:
            m.result?.penalties.reduce((acc, p) => acc + p.count, 0) ?? 0,
          items: revealedPenalties,
        },
      };
    });

    members.sort(
      (a, b) =>
        b.totalEscapeMs - a.totalEscapeMs ||
        a.memberId.localeCompare(b.memberId),
    );
    // 표준 경쟁 순위(1-2-2-4): 동점은 동일 순위, 다음 순위는 인원수만큼 건너뜀.
    members.forEach((m, idx) => {
      m.rank =
        idx > 0 && m.totalEscapeMs === members[idx - 1].totalEscapeMs
          ? members[idx - 1].rank
          : idx + 1;
    });

    // 실제 벌칙이 배정된(count 합계 > 0) 멤버 수 — tier1은 벌칙 0개이므로 tier 기준 사용 금지
    const penaltyMemberCount = members.filter(
      (m) => m.penalties.totalCount > 0,
    ).length;

    return {
      roomCode: room.code,
      roomTitle: room.title,
      totalSessionMs,
      serverTime: now,
      rouletteEndsAt,
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

  /** 룰렛 제한 시간 경과 시 미공개 벌칙을 일괄 자동 공개. 실제 공개 여부를 반환. */
  private async revealExpiredPenalties(
    room: RoomWithDetails,
  ): Promise<boolean> {
    if (!room.endedAt) return false;
    if (Date.now() <= room.endedAt.getTime() + ROULETTE_TIMEOUT_MS)
      return false;

    const memberIds = room.roomMembers.map((m) => m.id);
    if (memberIds.length === 0) return false;

    // 자동공개로 상태가 바뀔 멤버(미공개 보유) — 로드된 데이터로 판정
    const affected = room.roomMembers.filter((m) =>
      m.result?.penalties.some((p) => !p.isRevealed),
    );

    const { count } = await this.prisma.resultPenalty.updateMany({
      where: { roomMemberId: { in: memberIds }, isRevealed: false },
      data: { isRevealed: true },
    });

    // 타임아웃 자동공개도 spin/exit과 동일하게 실시간 동기화 (멱등 페이로드)
    if (count > 0) {
      for (const m of affected) {
        this.roomGateway.server.to(room.code).emit('result:revealed', {
          memberId: m.id,
          userId: m.userId,
          nickname: m.nickname,
          // 타임아웃은 전체 공개 → 그 멤버의 모든 벌칙이 공개분
          penalties:
            m.result?.penalties.map((p) => ({
              content: p.content,
              count: p.count,
            })) ?? [],
        });
      }
    }
    return count > 0;
  }

  async getResult(roomCode: string) {
    let room = await this.fetchRoom(roomCode);

    if (!room) throw new NotFoundException('결과를 찾을 수 없습니다.');

    // phase='closed'여도 endedAt 있으면 결과 조회 허용 (빈 방 정리와 결과 조회 공존).
    const isViewable =
      room.phase === 'result' ||
      (room.phase === 'closed' && room.endedAt !== null);
    if (!isViewable)
      throw new ForbiddenException(
        '세션이 종료된 후 결과를 확인할 수 있습니다.',
      );

    // [Fallback] 게스트 포함 멤버 중 ROOM_RESULT 미존재 시 재계산
    const hasUnprocessed = room.roomMembers.some((m) => m.result === null);
    if (hasUnprocessed) {
      try {
        await this.penaltyService.calculateAndSave(roomCode);
      } catch (err) {
        Sentry.captureException(err);
        throw new InternalServerErrorException(
          '결과 데이터를 생성하는 중 오류가 발생했습니다.',
        );
      }
      room = await this.fetchRoom(roomCode);
      if (!room) throw new NotFoundException('결과를 찾을 수 없습니다.');
    }

    // 룰렛 제한 시간 경과 시: 미공개 벌칙 일괄 자동 공개 (자리 뜬 멤버)
    if (await this.revealExpiredPenalties(room)) {
      room = (await this.fetchRoom(roomCode)) ?? room;
    }

    return this.buildResponse(room);
  }
}
