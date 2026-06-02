import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RoomGateway } from '../gateway/room/room.gateway';

@Injectable()
export class RouletteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomGateway: RoomGateway,
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

    // 마지막 스핀에서만 전체 공개 + 브로드캐스트 (중간 스핀은 DB 무변경)
    if (isFinished) {
      await this.prisma.resultPenalty.updateMany({
        where: { roomMemberId: member.id, isRevealed: false },
        data: { isRevealed: true },
      });
      await this.broadcastRevealed(roomCode, member);
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
        throw new BadRequestException('룰렛 처리가 이미 완료되었습니다.');
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
