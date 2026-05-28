import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class UsersService {
  private readonly validProfileImages = new Set([
    'basic_image_key_01',
    'basic_image_key_02',
    'basic_image_key_03',
    'basic_image_key_04',
    'basic_image_key_05',
    'basic_image_key_06',
    'basic_image_key_07',
    'basic_image_key_08',
    'basic_image_key_09',
    'basic_image_key_10',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. GET /users/me - 내 정보 조회
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nickname: true, email: true, profileImage: true },
    });

    if (!user) {
      throw new NotFoundException({
        message: '존재하지 않는 사용자입니다.',
        error: 'USER_NOT_FOUND',
      });
    }

    return {
      userId: user.id,
      nickname: user.nickname,
      email: user.email,
      profileImage: user.profileImage,
    };
  }

  /**
   * 2. PATCH /users/me - 내 정보 수정
   */
  async updateMe(userId: string, dto: UpdateUserDto) {
    await this.getMe(userId);

    if (dto.profileImage && !this.validProfileImages.has(dto.profileImage)) {
      throw new BadRequestException({
        message: '유효하지 않은 프로필 이미지입니다.',
        error: 'INVALID_REQUEST',
      });
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.nickname && { nickname: dto.nickname }),
        ...(dto.profileImage && { profileImage: dto.profileImage }),
      },
      select: { id: true, nickname: true, profileImage: true },
    });

    return {
      userId: updatedUser.id,
      nickname: updatedUser.nickname,
      profileImage: updatedUser.profileImage,
    };
  }

  /**
   * 3. DELETE /users/me - 회원 탈퇴
   */
  async deleteMe(userId: string) {
    await this.getMe(userId);

    const activeRoomMember = await this.prisma.roomMember.findFirst({
      where: {
        userId,
        room: {
          phase: {
            notIn: ['done', 'closed'],
          },
        },
      },
    });

    if (activeRoomMember) {
      throw new BadRequestException({
        message: '방 참여 중에는 탈퇴할 수 없습니다.',
        error: 'INVALID_REQUEST',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({
        where: { id: userId },
      });
    });

    return { success: true };
  }

  /**
   * 4. GET /users/me/history - 내가 참여한 방 히스토리
   */
  async getMyHistory(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const total = await this.prisma.roomMember.count({
      where: {
        userId,
        result: { isNot: null },
      },
    });

    const members = await this.prisma.roomMember.findMany({
      where: {
        userId,
        result: { isNot: null },
      },
      orderBy: {
        room: { endedAt: 'desc' },
      },
      skip,
      take: limit,
      include: {
        room: {
          select: {
            id: true,
            title: true,
            endedAt: true,
            _count: { select: { roomMembers: true } },
          },
        },
        result: {
          select: {
            totalEscapeMs: true,
            penaltyTier: true,
          },
        },
      },
    });

    const sessions = members.map((m) => ({
      roomId: m.room.id,
      roomTitle: m.room.title,
      profileImage: m.profileImage,
      totalEscapeMs: m.result?.totalEscapeMs || 0,
      penaltyTier: m.result?.penaltyTier || 0,
      memberCount: m.room._count.roomMembers,
      endedAt: m.room.endedAt,
    }));

    return {
      total,
      page,
      sessions,
    };
  }

  /**
   * 5. GET /users/me/stats - 내 통계 조회
   */
  async getMyStats(userId: string) {
    const aggregateResult = await this.prisma.roomMember.aggregate({
      where: {
        userId,
        result: { isNot: null },
      },
      _count: {
        id: true,
      },
    });

    const roomMembers = await this.prisma.roomMember.findMany({
      where: {
        userId,
        result: { isNot: null },
      },
      include: {
        room: {
          select: { startedAt: true, endedAt: true },
        },
        result: {
          select: { totalEscapeMs: true },
        },
      },
    });

    let totalFocusMs = 0;
    let totalEscapeMs = 0;

    roomMembers.forEach((m) => {
      totalEscapeMs += m.result?.totalEscapeMs || 0;
      if (m.room.startedAt && m.room.endedAt) {
        const sessionDuration =
          m.room.endedAt.getTime() - m.room.startedAt.getTime();
        const effectiveFocus = sessionDuration - (m.result?.totalEscapeMs || 0);
        totalFocusMs += effectiveFocus > 0 ? effectiveFocus : 0;
      }
    });

    const totalEscapeCount = await this.prisma.escapeLog.count({
      where: {
        roomMember: {
          userId,
        },
      },
    });

    return {
      totalRoomCount: aggregateResult._count.id,
      totalFocusMs,
      totalEscapeMs,
      totalEscapeCount,
    };
  }
}
