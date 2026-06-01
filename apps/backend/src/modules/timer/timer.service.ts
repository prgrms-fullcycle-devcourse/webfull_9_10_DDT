import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { RoomGateway } from '../gateway/room/room.gateway';

@Injectable()
export class TimerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly roomGateway: RoomGateway,
  ) {}

  private async verifyHost(roomCode: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
    });
    if (!room) throw new NotFoundException('방을 찾을 수 없습니다.');
    if (room.hostId !== userId)
      throw new ForbiddenException('방장 권한이 필요합니다.');
    return room;
  }

  async startTimer(roomCode: string, userId: string) {
    await this.verifyHost(roomCode, userId);

    const rawState = await this.redis.instance.get(`room:state:${roomCode}`);
    if (rawState) {
      const state = JSON.parse(rawState) as {
        members?: Record<string, { isSigned?: boolean }>;
      };
      const unsignedExists = Object.values(state.members || {}).some(
        (m) => !m.isSigned,
      );
      if (unsignedExists) {
        throw new BadRequestException(
          '아직 서명하지 않은 멤버가 있습니다. 강제 시작을 사용해주세요.',
        );
      }
    }

    const now = new Date();
    await this.prisma.room.update({
      where: { code: roomCode },
      data: { phase: 'timer', startedAt: now },
    });

    const responseData = {
      startedAt: now,
      currentPhase: 'focus',
      currentRound: 1,
      totalRounds: 4,
      phaseEndsAt: new Date(now.getTime() + 25 * 60000),
      serverTime: now,
    };

    this.roomGateway.server.to(roomCode).emit('session:started', responseData);
    return responseData;
  }

  async forceStartTimer(roomCode: string, userId: string) {
    await this.verifyHost(roomCode, userId);

    const kickedMemberIds: string[] = []; // Redis 기반 미서명자 추출 로직 추가 필요

    const now = new Date();
    await this.prisma.room.update({
      where: { code: roomCode },
      data: { phase: 'timer', startedAt: now },
    });

    const responseData = {
      kickedMemberIds,
      startedAt: now,
      currentPhase: 'focus',
      currentRound: 1,
      totalRounds: 4,
      phaseEndsAt: new Date(now.getTime() + 25 * 60000),
      serverTime: now,
    };

    this.roomGateway.server.to(roomCode).emit('session:started', responseData);
    return responseData;
  }

  async giveUp(roomCode: string, userId: string) {
    const isGuest = userId.startsWith('guest_');
    const member = await this.prisma.roomMember.findFirst({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: userId } : { userId }),
      },
      include: { room: true },
    });

    if (!member)
      throw new NotFoundException('방 참여 정보를 찾을 수 없습니다.');
    if (member.room.phase !== 'timer')
      throw new ConflictException('집중 진행 중에만 중도 포기할 수 있습니다.');
    if (member.gaveUpAt)
      throw new ConflictException('이미 중도 포기한 상태입니다.');

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.escapeLog.updateMany({
        where: { roomMemberId: member.id, returnedAt: null },
        data: { returnedAt: now },
      });

      await tx.roomMember.update({
        where: { id: member.id },
        data: { gaveUpAt: now },
      });
    });
    //탈주 처리 로직 추가 필요
    const responseData = { userId, gaveUpAt: now };
    this.roomGateway.server.to(roomCode).emit('member:gave-up', responseData);

    return responseData;
  }
}
