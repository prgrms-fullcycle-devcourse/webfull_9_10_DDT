import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../common/prisma.service';
import { randomUUID } from 'node:crypto';
import { AuthService } from '../auth/auth.service';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * 1. GET /users/me - 내 정보 조회
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        email: true,
        profileImage: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
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
  async deleteMe(userId: string, token?: string) {
    await this.getMe(userId);

    const activeRoom = await this.prisma.room.findFirst({
      where: {
        phase: { notIn: ['result', 'closed'] },
        OR: [{ hostId: userId }, { roomMembers: { some: { userId } } }],
      },
      select: { code: true },
    });

    if (activeRoom) {
      throw new BadRequestException({
        message: '진행 중인 방이 있어 탈퇴할 수 없습니다.',
        error: 'INVALID_REQUEST',
      });
    }

    const anonId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      await tx.ruleTemplate.deleteMany({
        where: { userId, isSaved: true },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          isTermsAgreed: false,
          nickname: '탈퇴한 사용자',
          email: `deleted_${anonId}@deleted.local`,
          providerId: `deleted_${anonId}`,
        },
      });
    });

    if (token) {
      await this.authService.logout(token);
    }

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
        result: { createdAt: 'desc' },
      },
      skip,
      take: limit,
      include: {
        room: {
          select: {
            code: true,
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
      roomCode: m.room.code,
      roomTitle: m.room.title,
      profileImage: m.profileImage,
      totalEscapeMs: m.result?.totalEscapeMs || 0,
      penaltyTier: m.result?.penaltyTier || 0,
      memberCount: m.room._count.roomMembers,
      endedAt: m.room.endedAt ?? m.gaveUpAt ?? new Date(),
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
      where: { userId, result: { isNot: null } },
      include: {
        room: {
          select: { startedAt: true, endedAt: true, template: true },
        },
        result: { select: { totalEscapeMs: true } },
      },
    });

    let totalFocusMs = 0;
    let totalEscapeMs = 0;

    roomMembers.forEach((m) => {
      totalEscapeMs += m.result?.totalEscapeMs || 0;
      if (m.room.startedAt && m.room.endedAt && m.room.template) {
        const { focusMin, rounds } = m.room.template;
        const plannedFocusMs = focusMin * rounds * 60 * 1000;
        const effectiveFocus = plannedFocusMs - (m.result?.totalEscapeMs || 0);

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
