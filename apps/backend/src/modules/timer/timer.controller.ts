import { Controller, Post, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TimerService } from './timer.service';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; role: string };
}

@ApiTags('Timer API (타이머 및 세션 제어)')
@Controller('rooms') // /rooms를 기본 경로로 사용
export class TimerController {
  constructor(private readonly timerService: TimerService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: '방 정상 시작 (방장 전용)' })
  @UseGuards(AuthGuard('jwt'))
  @Post(':roomId/timer/start')
  async startTimer(
    @Param('roomId') roomId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.timerService.startTimer(roomId, req.user!.id);
    return {
      statusCode: 200,
      timestamp: new Date().toISOString(),
      path: `/rooms/${roomId}/timer/start`,
      message: '세션이 시작되었습니다.',
      data,
      error: null,
    };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: '타이머 강제 시작 (미서명 인원 강퇴)' })
  @UseGuards(AuthGuard('jwt'))
  @Post(':roomId/timer/force-start')
  async forceStartTimer(
    @Param('roomId') roomId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.timerService.forceStartTimer(roomId, req.user!.id);
    return {
      statusCode: 200,
      timestamp: new Date().toISOString(),
      path: `/rooms/${roomId}/timer/force-start`,
      message: '세션이 강제 시작되었습니다.',
      data,
      error: null,
    };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: '중도 포기 (세션 강제 종료)' })
  @UseGuards(AuthGuard('jwt'))
  @Post(':roomId/give-up')
  async giveUp(
    @Param('roomId') roomId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.timerService.giveUp(roomId, req.user!.id);
    return {
      statusCode: 200,
      timestamp: new Date().toISOString(),
      path: `/rooms/${roomId}/give-up`,
      message: '세션이 강제 종료되었습니다.',
      data,
      error: null,
    };
  }
}
