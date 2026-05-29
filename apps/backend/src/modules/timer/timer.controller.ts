import { Controller, Post, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TimerService } from './timer.service';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; role: string };
}

@ApiTags('Timer API (타이머 및 세션 제어)')
@Controller('rooms')
export class TimerController {
  constructor(private readonly timerService: TimerService) {}

  @ApiBearerAuth()
  @ApiOperation({
    summary: '방 정상 시작 (방장 전용)',
    description:
      '전원 서명이 완료되어야 시작됩니다. 미서명 인원이 있으면 400을 반환합니다.',
  })
  @ApiParam({
    name: 'roomCode',
    description: '방 코드 (8자리)',
    example: 'V1StGXR8',
  })
  @ApiResponse({
    status: 201,
    description: '세션 시작 성공',
    schema: {
      example: {
        statusCode: 201,
        message: '세션이 시작되었습니다.',
        data: {
          startedAt: '2026-05-29T01:00:00.000Z',
          currentPhase: 'focus',
          currentRound: 1,
          totalRounds: 4,
          phaseEndsAt: '2026-05-29T01:25:00.000Z',
          serverTime: '2026-05-29T01:00:00.000Z',
        },
        error: null,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '아직 서명하지 않은 멤버가 있습니다.',
  })
  @ApiResponse({
    status: 401,
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiResponse({ status: 403, description: '방장 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '방을 찾을 수 없습니다.' })
  @UseGuards(AuthGuard('jwt'))
  @Post(':roomCode/timer/start')
  async startTimer(
    @Param('roomCode') roomCode: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.timerService.startTimer(roomCode, req.user!.id);
    return { message: '세션이 시작되었습니다.', data };
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: '타이머 강제 시작 (미서명 인원 강퇴)',
    description: '미서명 멤버를 제외하고 세션을 강제로 시작합니다. (방장 전용)',
  })
  @ApiParam({
    name: 'roomCode',
    description: '방 코드 (8자리)',
    example: 'V1StGXR8',
  })
  @ApiResponse({
    status: 201,
    description: '강제 시작 성공',
    schema: {
      example: {
        statusCode: 201,
        message: '세션이 강제 시작되었습니다.',
        data: {
          kickedMemberIds: ['guest_abcd'],
          startedAt: '2026-05-29T01:00:00.000Z',
          currentPhase: 'focus',
          currentRound: 1,
          totalRounds: 4,
          phaseEndsAt: '2026-05-29T01:25:00.000Z',
          serverTime: '2026-05-29T01:00:00.000Z',
        },
        error: null,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiResponse({ status: 403, description: '방장 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '방을 찾을 수 없습니다.' })
  @UseGuards(AuthGuard('jwt'))
  @Post(':roomCode/timer/force-start')
  async forceStartTimer(
    @Param('roomCode') roomCode: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.timerService.forceStartTimer(
      roomCode,
      req.user!.id,
    );
    return { message: '세션이 강제 시작되었습니다.', data };
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: '중도 포기 (세션 강제 종료)',
    description: '진행 중(timer)인 세션을 방장이 강제 종료합니다.',
  })
  @ApiParam({
    name: 'roomCode',
    description: '방 코드 (8자리)',
    example: 'V1StGXR8',
  })
  @ApiResponse({
    status: 201,
    description: '강제 종료 성공',
    schema: {
      example: {
        statusCode: 201,
        message: '세션이 강제 종료되었습니다.',
        data: { endedAt: '2026-05-29T01:10:00.000Z', reason: 'force-end' },
        error: null,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiResponse({ status: 403, description: '방장 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '방을 찾을 수 없습니다.' })
  @ApiResponse({
    status: 409,
    description: '집중 진행 중에만 강제 종료할 수 있습니다.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Post(':roomCode/give-up')
  async giveUp(
    @Param('roomCode') roomCode: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.timerService.giveUp(roomCode, req.user!.id);
    return { message: '세션이 강제 종료되었습니다.', data };
  }
}
