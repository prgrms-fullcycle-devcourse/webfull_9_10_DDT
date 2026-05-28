import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class RouletteService {
  constructor(private readonly prisma: PrismaService) {}

  async spinRoulette(
    roomId: string,
    spinIndex: number,
    userId?: string,
    guestToken?: string,
  ) {
    const isGuest = !userId && !!guestToken;

    const member = await this.prisma.roomMember.findFirst({
      where: { roomId, ...(isGuest ? { guestToken } : { userId }) },
      include: { result: { include: { penalties: true } } },
    });

    if (!member || !member.result)
      throw new BadRequestException('룰렛 정보가 없습니다.');

    const penalty = member.result.penalties[spinIndex - 1];
    if (!penalty)
      throw new BadRequestException('해당 스핀의 벌칙이 존재하지 않습니다.');
    if (penalty.isRevealed)
      throw new ConflictException('이미 실행된 룰렛입니다.');

    await this.prisma.resultPenalty.update({
      where: {
        roomMemberId_content: {
          roomMemberId: member.id,
          content: penalty.content,
        },
      },
      data: { isRevealed: true },
    });

    const remainingSpins =
      member.result.penalties.filter((p) => !p.isRevealed).length - 1;

    return {
      spinIndex,
      penaltyContent: penalty.content,
      remainingSpins: Math.max(remainingSpins, 0),
    };
  }

  async exitRoulette(roomId: string, userId?: string, guestToken?: string) {
    const member = await this.prisma.roomMember.findFirst({
      where: { roomId, OR: [{ userId }, { guestToken }] },
    });

    if (!member) throw new BadRequestException('멤버 정보를 찾을 수 없습니다.');

    const updateResult = await this.prisma.resultPenalty.updateMany({
      where: { roomMemberId: member.id, isRevealed: false },
      data: { isRevealed: true },
    });

    if (updateResult.count === 0) {
      throw new BadRequestException('룰렛 처리가 이미 완료되었습니다.');
    }

    return { autoRevealed: true };
  }
}
