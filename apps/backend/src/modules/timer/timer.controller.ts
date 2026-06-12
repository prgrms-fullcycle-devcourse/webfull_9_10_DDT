import { Controller, Post, Param, UseGuards, Req, Body } from '@nestjs/common';
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
import { SavePushSubscriptionDto } from './dto/push-subscription.dto';
import { BadRequestException } from '@nestjs/common';

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
    summary: '세션 중도 포기',
    description:
      '진행 중인 세션(timer)에서 요청한 사용자 본인의 참여를 중단합니다. 포기 시 본인만 이탈 처리되며, 방의 상태나 다른 참여자의 타이머는 유지됩니다.',
  })
  @ApiParam({
    name: 'roomCode',
    description: '방 코드 (8자리)',
    example: 'V1StGXR8',
  })
  @ApiResponse({
    status: 201,
    description: '중도 포기 성공',
    schema: {
      example: {
        statusCode: 201,
        message: '세션 중도 포기가 완료되었습니다.',
        data: { userId: 'uuid', gaveUpAt: '2026-05-29T01:10:00.000Z' },
        error: null,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiResponse({ status: 404, description: '방을 찾을 수 없습니다.' })
  @ApiResponse({
    status: 409,
    description: '진행 중인 세션이 아니거나 이미 포기한 상태입니다.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Post(':roomCode/give-up')
  async giveUp(
    @Param('roomCode') roomCode: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.timerService.giveUp(roomCode, req.user!.id);
    return { message: '세션 중도 포기가 완료되었습니다.', data };
  }
  @ApiBearerAuth()
  @ApiOperation({ summary: '푸시 알림 구독 정보 저장 (SNS 연동)' })
  @UseGuards(AuthGuard('jwt'))
  @Post(':roomCode/push-subscription')
  async savePushSubscription(
    @Param('roomCode') roomCode: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: SavePushSubscriptionDto,
  ) {
    const platform = body.platform || 'web';
    const tokenOrSub = platform === 'web' ? body.subscription : body.token;

    if (!tokenOrSub) {
      throw new BadRequestException(
        `플랫폼(${platform})에 맞는 푸시 알림 데이터(token 또는 subscription)가 누락되었습니다.`,
      );
    }
    await this.timerService.savePushSubscription(
      roomCode,
      req.user!.id,
      tokenOrSub,
      platform,
    );
    return { message: '알림 설정이 완료되었습니다.' };
  }
}
