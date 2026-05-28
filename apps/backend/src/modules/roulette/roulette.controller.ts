import { Controller, Post, Param, Body, Req, Headers } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
    const data = await this.rouletteService.spinRoulette(
      roomId,
      dto.spinIndex,
      req.user?.id,
      guestToken,
    );
    return { message: '룰렛이 스핀되었습니다.', data };
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
    const data = await this.rouletteService.exitRoulette(
      roomId,
      req.user?.id,
      guestToken,
    );
    return { message: '룰렛이 처리되었습니다.', data };
  }
}
