import { Controller, Post, Param, Body, Req, Headers } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
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
  @ApiHeader({
    name: 'X-Guest-Token',
    required: false,
    description: '게스트 토큰 (회원은 생략)',
  })
  @ApiOperation({
    summary: '룰렛 실행',
    description: 'spinIndex(1부터)의 벌칙을 공개합니다.',
  })
  @ApiParam({
    name: 'roomCode',
    description: '방 코드 (8자리)',
    example: 'V1StGXR8',
  })
  @ApiBody({ type: SpinRouletteDto })
  @ApiResponse({
    status: 201,
    description: '스핀 성공',
    schema: {
      example: {
        statusCode: 201,
        message: '룰렛이 스핀되었습니다.',
        data: {
          spinIndex: 1,
          penaltyContent: '팔굽혀펴기 10회',
          remainingSpins: 2,
        },
        error: null,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '룰렛 정보가 없거나 해당 스핀의 벌칙이 없습니다.',
  })
  @ApiResponse({ status: 409, description: '이미 실행된 룰렛입니다.' })
  @Post(':roomCode/roulette/spin')
  async spinRoulette(
    @Param('roomCode') roomCode: string,
    @Body() dto: SpinRouletteDto,
    @Req() req: AuthenticatedRequest,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const data = await this.rouletteService.spinRoulette(
      roomCode,
      dto.spinIndex,
      req.user?.id,
      guestToken,
    );
    return { message: '룰렛이 스핀되었습니다.', data };
  }

  @ApiBearerAuth()
  @ApiHeader({
    name: 'X-Guest-Token',
    required: false,
    description: '게스트 토큰 (회원은 생략)',
  })
  @ApiOperation({
    summary: '룰렛 이탈 처리 (Rage-quit)',
    description: '룰렛 도중 이탈 시 남은 벌칙을 모두 자동 공개 처리합니다.',
  })
  @ApiParam({
    name: 'roomCode',
    description: '방 코드 (8자리)',
    example: 'V1StGXR8',
  })
  @ApiResponse({
    status: 201,
    description: '이탈 처리 성공',
    schema: {
      example: {
        statusCode: 201,
        message: '룰렛이 처리되었습니다.',
        data: { autoRevealed: true },
        error: null,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '멤버 정보를 찾을 수 없거나 이미 처리 완료되었습니다.',
  })
  @Post(':roomCode/roulette/exit')
  async exitRoulette(
    @Param('roomCode') roomCode: string,
    @Req() req: AuthenticatedRequest,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const data = await this.rouletteService.exitRoulette(
      roomCode,
      req.user?.id,
      guestToken,
    );
    return { message: '룰렛이 처리되었습니다.', data };
  }
}
