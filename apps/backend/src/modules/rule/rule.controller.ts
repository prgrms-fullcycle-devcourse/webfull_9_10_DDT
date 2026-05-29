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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

  @ApiOperation({
    summary: '계약서 생성 및 할당 (방장 전용)',
    description:
      '방장이 설정한 규칙(목표 시간, 휴식 시간, 반복 횟수, 벌칙 등)을 바탕으로 방의 계약서를 확정하고 할당합니다.',
  })
  @ApiParam({
    name: 'roomCode',
    description: '방 코드 (8자리)',
    example: 'V1StGXR8',
  })
  @ApiBody({ type: CreateRoomRuleDto })
  @ApiResponse({ status: 201, description: '계약서 확정 성공' })
  @ApiResponse({
    status: 400,
    description: '벌칙 티어 구간이 연속적이지 않습니다.',
  })
  @ApiResponse({ status: 403, description: '방장 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '방을 찾을 수 없습니다.' })
  @Post('rooms/:roomCode/rule')
  async createRoomRule(
    @Param('roomCode') roomCode: string,
    @Body() dto: CreateRoomRuleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.ruleService.createRoomRule(
      roomCode,
      req.user!.id,
      dto,
    );
    return { message: '계약서가 확정되었습니다.', data };
  }

  @ApiOperation({
    summary: '저장된 계약서 조회',
    description: '내가 저장한 계약서 템플릿 목록을 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @Get('rules/saved')
  async getSavedRules(@Req() req: AuthenticatedRequest) {
    const data = await this.ruleService.getSavedRules(req.user!.id);
    return { message: '계약서를 조회했습니다.', data };
  }

  @ApiOperation({
    summary: '계약서 템플릿 저장',
    description: '제목과 함께 계약서를 템플릿으로 저장합니다.',
  })
  @ApiBody({ type: SaveRuleTemplateDto })
  @ApiResponse({ status: 201, description: '저장 성공' })
  @ApiResponse({
    status: 400,
    description: '벌칙 티어 구간이 연속적이지 않습니다.',
  })
  @ApiResponse({
    status: 409,
    description: '같은 이름의 계약서가 이미 존재합니다.',
  })
  @Post('rules/saved')
  async saveRuleTemplate(
    @Body() dto: SaveRuleTemplateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.ruleService.saveRuleTemplate(req.user!.id, dto);
    return { message: '계약서가 저장되었습니다.', data };
  }

  @ApiOperation({
    summary: '계약서 덮어쓰기',
    description: '기존 저장 템플릿을 수정합니다.',
  })
  @ApiParam({
    name: 'ruleId',
    description: '계약서 템플릿 ID',
    example: 'uuid',
  })
  @ApiBody({ type: SaveRuleTemplateDto })
  @ApiResponse({ status: 200, description: '수정 성공' })
  @ApiResponse({ status: 403, description: '수정 권한이 없는 계약서입니다.' })
  @ApiResponse({
    status: 409,
    description: '같은 이름의 계약서가 이미 존재합니다.',
  })
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
    return { message: '계약서가 수정되었습니다.', data };
  }

  @ApiOperation({
    summary: '저장된 계약서 삭제',
    description:
      '사용자가 개인 보관함에 저장해둔 특정 계약서 템플릿을 삭제합니다. 단, 현재 진행 중인 방에서 사용 중인 템플릿은 삭제할 수 없습니다.',
  })
  @ApiParam({
    name: 'ruleId',
    description: '계약서 템플릿 ID',
    example: 'uuid',
  })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @ApiResponse({ status: 403, description: '삭제 권한이 없는 계약서입니다.' })
  @ApiResponse({
    status: 409,
    description: '진행 중인 방에서 사용 중인 계약서는 삭제할 수 없습니다.',
  })
  @Delete('rules/saved/:ruleId')
  async deleteRuleTemplate(
    @Param('ruleId') ruleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.ruleService.deleteRuleTemplate(req.user!.id, ruleId);
    return { message: '계약서가 삭제되었습니다.', data: null };
  }
}
