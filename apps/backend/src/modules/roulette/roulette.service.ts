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

    // spinIndex는 content 오름차순 고정 순서를 전제로 한다.
    const penalty = member.result.penalties[spinIndex - 1];
    if (!penalty)
      throw new BadRequestException('해당 스핀의 벌칙이 존재하지 않습니다.');
    if (penalty.isRevealed)
      throw new ConflictException('이미 실행된 룰렛입니다.');

    // content → PENALTY_ITEM.id 매핑 (휠 정지 위치 식별용)
    const penaltyItemMap = this.buildPenaltyItemMap(member);

    // 공개 + 잔여 개수 산정을 원자적으로 처리 (remainingSpins 정합성 보장)
    const remainingSpins = await this.prisma.$transaction(async (tx) => {
      await tx.resultPenalty.update({
        where: {
          roomMemberId_content: {
            roomMemberId: member.id,
            content: penalty.content,
          },
        },
        data: { isRevealed: true },
      });
      return tx.resultPenalty.count({
        where: { roomMemberId: member.id, isRevealed: false },
      });
    });

    const isFinished = remainingSpins === 0;

    // 마지막 스핀 → 다른 멤버 화면 실시간 동기화
    if (isFinished) await this.broadcastRevealed(roomCode, member);

    return {
      spinIndex,
      penaltyItemId: penaltyItemMap.get(penalty.content) ?? null,
      penaltyContent: penalty.content,
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
