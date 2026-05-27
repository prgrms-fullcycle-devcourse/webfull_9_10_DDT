import { Controller, Post, Param, Body, Req, Headers } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RouletteService } from './roulette.service';
import { SpinRouletteDto } from './dto/roulette.dto';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@ApiTags('Roulette API (벌칙 룰렛)')
@Controller('rooms')
export class RouletteController {
  constructor(private readonly rouletteService: RouletteService) {}

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Guest-Token', required: false })
  @ApiOperation({ summary: '룰렛 실행' })
  @Post(':roomId/roulette/spin')
  async spinRoulette(
    @Param('roomId') roomId: string,
    @Body() dto: SpinRouletteDto,
    @Req() req: AuthenticatedRequest,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const userId = req.user?.id;
    const data = await this.rouletteService.spinRoulette(roomId, dto.spinIndex, userId, guestToken);
    return {
      statusCode: 200,
      timestamp: new Date().toISOString(),
      path: `/rooms/${roomId}/roulette/spin`,
      message: '룰렛이 스핀되었습니다.',
      data,
      error: null,
    };
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Guest-Token', required: false })
  @ApiOperation({ summary: '룰렛 이탈 처리 (Rage-quit)' })
  @Post(':roomId/roulette/exit')
  async exitRoulette(
    @Param('roomId') roomId: string,
    @Req() req: AuthenticatedRequest,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const userId = req.user?.id;
    const data = await this.rouletteService.exitRoulette(roomId, userId, guestToken);
    return {
      statusCode: 200,
      timestamp: new Date().toISOString(),
      path: `/rooms/${roomId}/roulette/exit`,
      message: '룰렛이 처리되었습니다.',
      data,
      error: null,
    };
  }
}