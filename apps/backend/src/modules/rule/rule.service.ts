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

const MAX_TOTAL_MIN = 600;

@Injectable()
export class RuleService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyHost(roomCode: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
    });
    if (!room) throw new NotFoundException('방을 찾을 수 없습니다.');
    if (room.hostId !== userId)
      throw new ForbiddenException('방장 권한이 필요합니다.');

    return room;
  }

  private validateTiers(
    tiers: Array<{ maxPct: number | null; minPct: number }>,
  ) {
    for (let i = 0; i < tiers.length - 1; i++) {
      if (tiers[i].maxPct !== tiers[i + 1].minPct) {
        throw new BadRequestException('벌칙 티어 구간이 연속적이지 않습니다.');
      }
    }
  }

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

  // 3. 계약서 템플릿 저장
  async saveRuleTemplate(userId: string, dto: SaveRuleTemplateDto) {
    this.validateTiers(dto.tierConfig.tiers);

    const existing = await this.prisma.ruleTemplate.findUnique({
      where: { userId_title: { userId, title: dto.title } },
    });
    if (existing)
      throw new ConflictException('같은 이름의 계약서가 이미 존재합니다.');

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

  // 4. 계약서 덮어쓰기
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
      throw new ForbiddenException('수정 권한이 없는 계약서입니다.');

    const duplicateTitle = await this.prisma.ruleTemplate.findFirst({
      where: { userId, title: dto.title, id: { not: ruleId } },
    });
    if (duplicateTitle)
      throw new ConflictException('같은 이름의 계약서가 이미 존재합니다.');

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

  // 5. 계약서 삭제
  async deleteRuleTemplate(userId: string, ruleId: string) {
    const rule = await this.prisma.ruleTemplate.findUnique({
      where: { id: ruleId },
    });
    if (!rule || rule.userId !== userId)
      throw new ForbiddenException('삭제 권한이 없는 계약서입니다.');

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
