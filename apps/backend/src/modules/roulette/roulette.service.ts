import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RoomGateway } from '../gateway/room/room.gateway';
import { PenaltyService } from '../penalty/penalty.service';

@Injectable()
export class RouletteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomGateway: RoomGateway,
    private readonly penaltyService: PenaltyService,
  ) {}

  async spinRoulette(
    roomCode: string,
    spinIndex: number,
    userId: string | null,
    guestToken: string | null,
  ) {
    const isGuest = !userId && !!guestToken;

    const member = await this.prisma.roomMember.findFirst({
      where: { roomCode, ...(isGuest ? { guestToken } : { userId }) },
      include: {
        result: {
          include: { penalties: { orderBy: { content: 'asc' } } },
        },
        room: { include: { template: { include: { penalties: true } } } },
      },
    });

    if (!member || !member.result)
      throw new BadRequestException('룰렛 정보가 없습니다.');

    const penalties = member.result.penalties;

    // 이미 전부 공개된 상태면 더 돌릴 수 없음
    if (penalties.length > 0 && penalties.every((p) => p.isRevealed))
      throw new ConflictException('이미 완료된 룰렛입니다.');

    // spinIndex = content 오름차순을 count만큼 펼친 '전역 스핀 순번'(1..총합)
    const totalSpins = penalties.reduce((acc, p) => acc + p.count, 0);
    if (spinIndex < 1 || spinIndex > totalSpins)
      throw new BadRequestException('해당 스핀의 벌칙이 존재하지 않습니다.');

    // spinIndex번째 인스턴스가 속한 행(content)을 결정적으로 계산 (중간 상태 미저장)
    let cumulative = 0;
    let target: (typeof penalties)[number] | undefined;
    for (const p of penalties) {
      cumulative += p.count;
      if (spinIndex <= cumulative) {
        target = p;
        break;
      }
    }
    if (!target)
      throw new BadRequestException('해당 스핀의 벌칙이 존재하지 않습니다.');

    const remainingSpins = totalSpins - spinIndex;
    const isFinished = remainingSpins === 0;

    // 마지막 스핀에서만 전체 공개 + 브로드캐스트 (중간 스핀은 DB 무변경).
    // updateMany의 count를 권위로 삼아 동시 호출의 패자(count=0)는 broadcast 생략(exit과 대칭).
    if (isFinished) {
      const { count } = await this.prisma.resultPenalty.updateMany({
        where: { roomMemberId: member.id, isRevealed: false },
        data: { isRevealed: true },
      });
      if (count > 0) await this.broadcastRevealed(roomCode, member);
    }

    // content → PENALTY_ITEM.id 매핑 (휠 정지 위치 식별용)
    const penaltyItemMap = this.buildPenaltyItemMap(member);

    return {
      spinIndex,
      penaltyItemId: penaltyItemMap.get(target.content) ?? null,
      penaltyContent: target.content,
      remainingSpins,
      isFinished,
    };
  }

  async exitRoulette(
    roomCode: string,
    userId: string | null,
    guestToken: string | null,
  ) {
    const isGuest = !userId && !!guestToken;

    const member = await this.prisma.roomMember.findFirst({
      where: { roomCode, ...(isGuest ? { guestToken } : { userId }) },
      include: {
        room: { include: { template: { include: { penalties: true } } } },
      },
    });

    if (!member) throw new BadRequestException('멤버 정보를 찾을 수 없습니다.');

    // 미공개 목록 확보(반환용) + 일괄 공개를 원자적으로 처리.
    // updateMany의 count를 권위로 삼아, 동시 호출의 패자(count=0)는 아래 broadcast 없이 차단(spin과 대칭).
    const unrevealed = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.resultPenalty.findMany({
        where: { roomMemberId: member.id, isRevealed: false },
        select: { content: true, count: true },
      });
      if (rows.length === 0) {
        // 0건은 '이미 전부 공개됨'(result 존재)과 '미산정'(result 부재) 두 경우 → 구분.
        const result = await tx.roomResult.findUnique({
          where: { roomMemberId: member.id },
          select: { roomMemberId: true },
        });
        throw new BadRequestException(
          result
            ? '룰렛 처리가 이미 완료되었습니다.'
            : '아직 결과가 산정되지 않았습니다. 잠시 후 다시 시도해주세요.',
        );
      }
      const { count } = await tx.resultPenalty.updateMany({
        where: { roomMemberId: member.id, isRevealed: false },
        data: { isRevealed: true },
      });
      if (count === 0) {
        throw new BadRequestException('룰렛 처리가 이미 완료되었습니다.');
      }
      return rows;
    });

    const penaltyItemMap = this.buildPenaltyItemMap(member);
    const revealedPenalties = unrevealed.map((p) => ({
      id: penaltyItemMap.get(p.content) ?? null,
      content: p.content,
      count: p.count,
    }));

    await this.broadcastRevealed(roomCode, member);

    return { autoRevealed: true, revealedPenalties };
  }

  /**
   * 중도포기자 룰렛 화면 데이터 조회 (phase 무관, Read-only).
   * 포기자 본인 데이터만 반환. give-up 시점 산정 실패로 결과 미존재 시 fallback 재산정(멱등).
   */
  async getGiveUpResult(
    roomCode: string,
    userId: string | null,
    guestToken: string | null,
  ) {
    const isGuest = !userId && !!guestToken;
    const where: Prisma.RoomMemberWhereInput = {
      roomCode,
      ...(isGuest ? { guestToken } : { userId }),
    };

    let member = await this.fetchGiveUpMember(where);

    if (!member) throw new BadRequestException('멤버 정보를 찾을 수 없습니다.');
    // 포기자 전용 — gaveUpAt 없으면 차단(일반 유저는 GET /result 사용)
    if (!member.gaveUpAt)
      throw new BadRequestException('중도포기한 유저만 조회할 수 있습니다.');

    // fallback: give-up 시점 산정 실패로 결과 미존재 시 재산정 후 재조회
    // (result.service의 hasUnprocessed fallback과 동일 패턴, 멱등 보장)
    if (!member.result) {
      try {
        await this.penaltyService.calculateAndSaveForGiveUp(
          roomCode,
          member.id,
        );
      } catch (err) {
        Sentry.captureException(err);
        throw new InternalServerErrorException(
          '결과 데이터를 생성하는 중 오류가 발생했습니다.',
        );
      }
      member = await this.fetchGiveUpMember(where);
      if (!member)
        throw new BadRequestException('멤버 정보를 찾을 수 없습니다.');
    }

    // 재산정 후에도 결과가 없으면(이론상 도달 불가) 빈 결과 무음 반환 대신 명시적 실패.
    if (!member.result)
      throw new InternalServerErrorException('결과 데이터를 찾을 수 없습니다.');

    const penaltyItemMap = this.buildPenaltyItemMap(member);
    const penaltyPool = (member.room.template?.penalties ?? []).map((p) => ({
      itemId: p.id,
      content: p.content,
    }));
    const penalties = (member.result?.penalties ?? []).map((p) => ({
      itemId: penaltyItemMap.get(p.content) ?? null,
      content: p.content,
      count: p.count,
    }));

    return {
      gaveUpAt: member.gaveUpAt,
      totalEscapeMs: member.result?.totalEscapeMs ?? 0,
      penaltyPool,
      penalties,
    };
  }

  /** 중도포기 조회용 멤버 로드 (result/penalties + template/penalties 포함) */
  private fetchGiveUpMember(where: Prisma.RoomMemberWhereInput) {
    return this.prisma.roomMember.findFirst({
      where,
      include: {
        result: {
          include: { penalties: { orderBy: { content: 'asc' } } },
        },
        room: { include: { template: { include: { penalties: true } } } },
      },
    });
  }

  /** content → PENALTY_ITEM.id 매핑 테이블 생성 */
  private buildPenaltyItemMap(member: {
    room: { template: { penalties: { content: string; id: string }[] } | null };
  }): Map<string, string> {
    // 동일 content가 풀에 중복되면 '첫 항목' id를 유지한다 (DTO 명세 일치).
    const map = new Map<string, string>();
    for (const p of member.room.template?.penalties ?? []) {
      if (!map.has(p.content)) {
        map.set(p.content, p.id);
      }
    }
    return map;
  }

  /** 룰렛 완료 시 방 전체에 공개 결과 브로드캐스트 */
  private async broadcastRevealed(
    roomCode: string,
    member: { id: string; userId: string | null; nickname: string },
  ): Promise<void> {
    const penalties = await this.prisma.resultPenalty.findMany({
      where: { roomMemberId: member.id, isRevealed: true },
      select: { content: true, count: true },
    });
    this.roomGateway.server.to(roomCode).emit('result:revealed', {
      memberId: member.id,
      userId: member.userId,
      nickname: member.nickname,
      penalties,
    });
  }
}
