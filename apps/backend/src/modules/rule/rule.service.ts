import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateRoomRuleDto, SaveRuleTemplateDto } from './dto/rule.dto';
import { Prisma } from '@prisma/client';

/** 총 세션 시간 상한 (10시간 = 600분) */
const MAX_TOTAL_MIN = 600;

/**
 * 계약서(각서) 규칙 관리 서비스.
 * 방 계약서 생성, 저장된 템플릿 CRUD를 담당합니다.
 */
@Injectable()
export class RuleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 요청자가 해당 방의 방장인지 검증합니다.
   *
   * @param roomCode - 방 코드
   * @param userId - 요청자 ID
   * @returns 방 엔티티
   * @throws NotFoundException 방이 없을 때
   * @throws ForbiddenException 방장이 아닐 때
   */
  private async verifyHost(roomCode: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
    });
    if (!room) throw new NotFoundException('방을 찾을 수 없습니다.');
    if (room.hostId !== userId)
      throw new ForbiddenException('방장 권한이 필요합니다.');

    return room;
  }

  /**
   * 벌칙 등급 구간이 연속적인지 검증합니다.
   * 이전 등급의 maxPct가 다음 등급의 minPct와 일치해야 합니다.
   *
   * @param tiers - 벌칙 등급 배열
   * @throws BadRequestException 구간이 불연속일 때
   */
  private validateTiers(
    tiers: Array<{ maxPct: number | null; minPct: number }>,
  ) {
    for (let i = 0; i < tiers.length - 1; i++) {
      if (tiers[i].maxPct !== tiers[i + 1].minPct) {
        throw new BadRequestException('벌칙 단계 구간이 연속적이지 않습니다.');
      }
    }
  }

  /**
   * 방에 계약서(각서) 규칙을 생성하고 템플릿으로 할당합니다.
   * 총 세션 시간이 10시간을 초과하면 거부합니다.
   *
   * @param roomCode - 방 코드
   * @param userId - 방장 ID
   * @param dto - 계약서 생성 DTO (focusMin, breakMin, rounds, penalties, tierConfig)
   * @returns 생성된 규칙 정보 (ruleId, 타이머 설정, 벌칙 목록, 등급 설정)
   * @throws BadRequestException 세션 시간 초과 또는 등급 불연속
   */
  async createRoomRule(
    roomCode: string,
    userId: string,
    dto: CreateRoomRuleDto,
  ) {
    await this.verifyHost(roomCode, userId);
    this.validateTiers(dto.tierConfig.tiers);

    const totalMin =
      dto.focusMin * dto.rounds + dto.breakMin * Math.max(0, dto.rounds - 1);

    if (totalMin > MAX_TOTAL_MIN) {
      throw new BadRequestException(
        `총 세션 시간이 10시간을 초과할 수 없습니다. (현재: ${totalMin}분)`,
      );
    }

    const rule = await this.prisma.ruleTemplate.create({
      data: {
        userId,
        isSaved: false,
        title: null,
        focusMin: dto.focusMin,
        breakMin: dto.breakMin,
        rounds: dto.rounds,
        tierConfig: dto.tierConfig as unknown as Prisma.InputJsonValue,
        penalties: {
          create: dto.penalties
            .filter((p) => p.trim() !== '')
            .map((content) => ({ content })),
        },
      },
      include: { penalties: true },
    });

    // 방에 템플릿 할당
    await this.prisma.room.update({
      where: { code: roomCode },
      data: { templateId: rule.id },
    });

    return {
      ruleId: rule.id,
      focusMin: rule.focusMin,
      breakMin: rule.breakMin,
      rounds: rule.rounds,
      penalties: rule.penalties.map((p) => ({
        itemId: p.id,
        content: p.content,
      })),
      tierConfig: rule.tierConfig,
    };
  }

  /**
   * 사용자가 저장한 계약서 템플릿 목록을 조회합니다.
   * 최신순으로 정렬됩니다.
   *
   * @param userId - 사용자 ID
   * @returns 저장된 템플릿 배열
   */
  async getSavedRules(userId: string) {
    const rules = await this.prisma.ruleTemplate.findMany({
      where: { userId, isSaved: true },
      orderBy: { createdAt: 'desc' },
      include: { penalties: true },
    });

    return rules.map((rule) => ({
      ruleId: rule.id,
      title: rule.title,
      focusMin: rule.focusMin,
      breakMin: rule.breakMin,
      rounds: rule.rounds,
      penalties: rule.penalties.map((p) => ({
        itemId: p.id,
        content: p.content,
      })),
      tierConfig: rule.tierConfig,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    }));
  }

  /**
   * 새 계약서 템플릿을 저장합니다.
   * 동일 사용자의 같은 제목이 이미 존재하면 거부합니다.
   *
   * @param userId - 사용자 ID
   * @param dto - 저장할 템플릿 DTO (title, focusMin, breakMin, rounds, penalties, tierConfig)
   * @returns { ruleId, title, createdAt }
   * @throws ConflictException 동일 제목의 템플릿이 이미 존재할 때
   */
  async saveRuleTemplate(userId: string, dto: SaveRuleTemplateDto) {
    this.validateTiers(dto.tierConfig.tiers);

    const existing = await this.prisma.ruleTemplate.findUnique({
      where: { userId_title: { userId, title: dto.title } },
    });
    if (existing)
      throw new ConflictException('같은 이름의 각서가 이미 존재합니다.');

    const rule = await this.prisma.ruleTemplate.create({
      data: {
        userId,
        isSaved: true,
        title: dto.title,
        focusMin: dto.focusMin,
        breakMin: dto.breakMin,
        rounds: dto.rounds,
        tierConfig: dto.tierConfig as unknown as Prisma.InputJsonValue,
        penalties: {
          create: dto.penalties
            .filter((p) => p.trim() !== '')
            .map((content) => ({ content })),
        },
      },
    });

    return { ruleId: rule.id, title: rule.title, createdAt: rule.createdAt };
  }

  /**
   * 기존 계약서 템플릿을 덮어씁니다.
   * 벌칙 목록을 전부 삭제 후 새로 생성하는 방식으로 교체합니다.
   *
   * @param userId - 사용자 ID
   * @param ruleId - 수정할 템플릿 ID
   * @param dto - 수정할 템플릿 DTO
   * @returns { ruleId, title, updatedAt }
   * @throws ForbiddenException 본인 템플릿이 아닐 때
   * @throws ConflictException 동일 제목의 다른 템플릿이 존재할 때
   */
  async updateRuleTemplate(
    userId: string,
    ruleId: string,
    dto: SaveRuleTemplateDto,
  ) {
    this.validateTiers(dto.tierConfig.tiers);

    const rule = await this.prisma.ruleTemplate.findUnique({
      where: { id: ruleId },
    });
    if (!rule || rule.userId !== userId)
      throw new ForbiddenException('수정 권한이 없는 각서입니다.');

    const duplicateTitle = await this.prisma.ruleTemplate.findFirst({
      where: { userId, title: dto.title, id: { not: ruleId } },
    });
    if (duplicateTitle)
      throw new ConflictException('같은 이름의 각서가 이미 존재합니다.');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.penaltyItem.deleteMany({ where: { templateId: ruleId } });
      return tx.ruleTemplate.update({
        where: { id: ruleId },
        data: {
          title: dto.title,
          focusMin: dto.focusMin,
          breakMin: dto.breakMin,
          rounds: dto.rounds,
          tierConfig: dto.tierConfig as unknown as Prisma.InputJsonValue,
          penalties: {
            create: dto.penalties
              .filter((p) => p.trim() !== '')
              .map((content) => ({ content })),
          },
        },
      });
    });

    return {
      ruleId: updated.id,
      title: updated.title,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * 저장된 계약서 템플릿을 삭제합니다.
   * 현재 진행 중인 방에서 사용 중인 템플릿은 삭제할 수 없습니다.
   *
   * @param userId - 사용자 ID
   * @param ruleId - 삭제할 템플릿 ID
   * @returns null
   * @throws ForbiddenException 본인 템플릿이 아닐 때
   * @throws ConflictException 진행 중인 방에서 사용 중일 때
   */
  async deleteRuleTemplate(userId: string, ruleId: string) {
    const rule = await this.prisma.ruleTemplate.findUnique({
      where: { id: ruleId },
    });
    if (!rule || rule.userId !== userId)
      throw new ForbiddenException('삭제 권한이 없는 각서입니다.');

    const activeRoom = await this.prisma.room.findFirst({
      where: {
        templateId: ruleId,
        phase: { notIn: ['closed', 'result'] },
      },
    });
    if (activeRoom)
      throw new ConflictException(
        '현재 진행 중인 방에서 사용 중인 계약서는 삭제할 수 없습니다.',
      );

    await this.prisma.ruleTemplate.delete({ where: { id: ruleId } });
    return null;
  }
}
