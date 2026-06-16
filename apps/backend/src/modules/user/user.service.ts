import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../common/prisma.service';
import { randomUUID } from 'node:crypto';
import { AuthService } from '../auth/auth.service';

/**
 * 사용자 프로필 관리 서비스.
 * 내 정보 조회/수정, 회원 탈퇴, 참여 기록 조회, 통계 조회를 담당합니다.
 */
@Injectable()
export class UsersService {
  /** 허용된 프로필 이미지 키 목록. 유효하지 않은 키는 업데이트 시 거부됩니다. */
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
   * 현재 로그인한 사용자의 프로필 정보를 반환합니다.
   * 탈퇴한 사용자(deletedAt 존재)는 조회 불가합니다.
   *
   * @param userId - 사용자 ID
   * @returns { userId, nickname, email, profileImage }
   * @throws NotFoundException 사용자가 없거나 탈퇴한 경우
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
   * 닉네임 또는 프로필 이미지를 수정합니다.
   * 프로필 이미지는 validProfileImages에 포함된 키만 허용됩니다.
   *
   * @param userId - 사용자 ID
   * @param dto - 수정할 필드 (nickname, profileImage)
   * @returns 수정된 { userId, nickname, profileImage }
   * @throws BadRequestException 유효하지 않은 프로필 이미지 키
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
   * 회원 탈퇴를 처리합니다.
   * 진행 중인 방이 있으면 탈퇴 불가합니다.
   * 개인정보를 익명화하고 저장된 각서 템플릿을 삭제합니다.
   * 토큰이 있으면 블랙리스트에 등록하여 로그아웃 처리합니다.
   *
   * @param userId - 사용자 ID
   * @param token - 현재 JWT 토큰 (블랙리스트 등록용, 선택)
   * @returns { success: true }
   * @throws BadRequestException 진행 중인 방이 있을 때
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
   * 사용자의 참여 기록을 페이지네이션으로 조회합니다.
   * 결과(roomResult)가 존재하는 방만 포함됩니다.
   * 중도포기자는 방 종료 시각 대신 gaveUpAt을 사용합니다.
   *
   * @param userId - 사용자 ID
   * @param page - 페이지 번호 (1부터 시작)
   * @param limit - 페이지당 항목 수
   * @returns { total, page, sessions }
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
      gaveUp: m.gaveUpAt != null, // 탈옥 여부
    }));

    return {
      total,
      page,
      sessions,
    };
  }

  /**
   * 사용자의 누적 통계를 계산하여 반환합니다.
   * 총 참여 횟수, 실질 집중 시간(계획 - 이탈), 총 이탈 시간, 총 이탈 횟수를 포함합니다.
   *
   * @param userId - 사용자 ID
   * @returns { totalRoomCount, totalFocusMs, totalEscapeMs, totalEscapeCount }
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
