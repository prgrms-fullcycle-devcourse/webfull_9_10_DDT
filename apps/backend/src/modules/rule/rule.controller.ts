import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RuleService } from './rule.service';
import { CreateRoomRuleDto, SaveRuleTemplateDto } from './dto/rule.dto';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@ApiTags('Rule API (계약서 관리)')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class RuleController {
  constructor(private readonly ruleService: RuleService) {}

  @ApiOperation({ summary: '계약서 생성 (방장 전용)' })
  @Post('rooms/:roomId/rule')
  async createRoomRule(
    @Param('roomId') roomId: string,
    @Body() dto: CreateRoomRuleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.ruleService.createRoomRule(
      roomId,
      req.user!.id,
      dto,
    );
    return {
      statusCode: 200,
      timestamp: new Date().toISOString(),
      path: `/rooms/${roomId}/rule`,
      message: '계약서가 확정되었습니다.',
      data,
      error: null,
    };
  }

  @ApiOperation({ summary: '저장된 계약서 조회' })
  @Get('rules/saved')
  async getSavedRules(@Req() req: AuthenticatedRequest) {
    const data = await this.ruleService.getSavedRules(req.user!.id);
    return {
      statusCode: 200,
      timestamp: new Date().toISOString(),
      path: '/rules/saved',
      message: '계약서를 조회했습니다.',
      data,
      error: null,
    };
  }

  @ApiOperation({ summary: '계약서 템플릿 저장' })
  @Post('rules/saved')
  async saveRuleTemplate(
    @Body() dto: SaveRuleTemplateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.ruleService.saveRuleTemplate(req.user!.id, dto);
    return {
      statusCode: 201,
      timestamp: new Date().toISOString(),
      path: '/rules/saved',
      message: '계약서가 저장되었습니다.',
      data,
      error: null,
    };
  }

  @ApiOperation({ summary: '계약서 덮어쓰기' })
  @Put('rules/saved/:ruleId')
  async updateRuleTemplate(
    @Param('ruleId') ruleId: string,
    @Body() dto: SaveRuleTemplateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.ruleService.updateRuleTemplate(
      req.user!.id,
      ruleId,
      dto,
    );
    return {
      statusCode: 200,
      timestamp: new Date().toISOString(),
      path: `/rules/saved/${ruleId}`,
      message: '계약서가 수정되었습니다.',
      data,
      error: null,
    };
  }

  @ApiOperation({ summary: '계약서 삭제' })
  @Delete('rules/saved/:ruleId')
  async deleteRuleTemplate(
    @Param('ruleId') ruleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.ruleService.deleteRuleTemplate(req.user!.id, ruleId);
    return {
      statusCode: 200,
      timestamp: new Date().toISOString(),
      path: `/rules/saved/${ruleId}`,
      message: '계약서가 삭제되었습니다.',
      data: null,
      error: null,
    };
  }
}
