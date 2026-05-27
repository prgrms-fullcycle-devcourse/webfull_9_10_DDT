import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class ResultService {
  constructor(private readonly prisma: PrismaService) {}

  async getResult(roomId: string, _userId?: string, _guestToken?: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        roomMembers: {
          include: { result: { include: { penalties: true } }, escapeLogs: true },
        },
      },
    });

    if (!room) throw new NotFoundException('결과를 찾을 수 없습니다.');
    if (room.phase === 'timer') throw new ForbiddenException('세션이 종료된 후 결과를 확인할 수 있습니다.');

    const now = new Date().getTime();
    const tenMinutesPassed = room.endedAt 
      ? (now - room.endedAt.getTime()) >= 10 * 60 * 1000 
      : false;

    const members = room.roomMembers.map((m) => {
      const totalEscapeMs = m.result?.totalEscapeMs || 0;
      return {
        memberId: m.id,
        userId: m.userId,
        nickname: m.nickname,
        profileImage: m.profileImage,
        isLoggedIn: m.isLoggedIn,
        rank: 0, 
        totalEscapeMs,
        escapeCount: m.escapeLogs.length,
        escapePercent: 0, 
        penaltyTier: m.result?.penaltyTier || 0,
        isAllClear: totalEscapeMs === 0,
        gaveUpAt: m.gaveUpAt,
        penalties: {
          totalCount: m.result?.penalties.reduce((acc, p) => acc + p.count, 0) || 0,
          items: m.result?.penalties.map(p => {
            const isExposed = p.isRevealed || tenMinutesPassed;
            return {
              content: isExposed ? p.content : '미정',
              count: p.count,
              isRevealed: p.isRevealed 
            };
          }) || [],
        },
      };
    });

    members.sort((a, b) => b.totalEscapeMs - a.totalEscapeMs);
    members.forEach((m, idx) => m.rank = idx + 1);

    return {
      roomId: room.id,
      roomTitle: room.title,
      focusMin: 25, 
      breakMin: 5,
      rounds: 4,
      completedRounds: 4,
      startedAt: room.startedAt,
      endedAt: room.endedAt,
      allClear: members.every(m => m.isAllClear),
      members,
      escapeLogs: []
    };
  }
}