import { Controller, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RouletteService } from './roulette.service';
import {
  SpinRouletteDto,
  SpinRouletteResponseDto,
  ExitRouletteResponseDto,
} from './dto/roulette.dto';
import { ApiSuccessResponse } from '../../common/swagger/api-success-response.decorator';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
}

@ApiTags('Roulette API (벌칙 룰렛)')
@Controller('rooms')
export class RouletteController {
  constructor(private readonly rouletteService: RouletteService) {}

  @ApiBearerAuth()
  @ApiOperation({
    summary: '룰렛 실행',
    description:
      'spinIndex(절대 위치, 1부터) 벌칙 행을 공개합니다. 룰렛 휠 항목은 result 응답 rule.penalties(공개 풀)로 ' +
      '구성하고, 본인 미공개 벌칙 content는 응답에 오지 않습니다(count만 노출). 휠 정지 위치는 응답 penaltyItemId로 ' +
      '매핑합니다. 회원·게스트 모두 Bearer JWT로 호출합니다.',
  })
  @ApiParam({
    name: 'roomCode',
    description: '방 코드 (8자리)',
    example: 'V1StGXR8',
  })
  @ApiBody({ type: SpinRouletteDto })
  @ApiSuccessResponse(SpinRouletteResponseDto, {
    status: 201,
    description: '스핀 성공',
  })
  @ApiResponse({
    status: 401,
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiResponse({
    status: 400,
    description: '룰렛 정보가 없거나 해당 스핀의 벌칙이 없습니다.',
  })
  @ApiResponse({ status: 409, description: '이미 실행된 룰렛입니다.' })
  @Post(':roomCode/roulette/spin')
  @UseGuards(AuthGuard('jwt'))
  async spinRoulette(
    @Param('roomCode') roomCode: string,
    @Body() dto: SpinRouletteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const isGuest = req.user.role === 'guest';
    const data = await this.rouletteService.spinRoulette(
      roomCode,
      dto.spinIndex,
      isGuest ? null : req.user.id,
      isGuest ? req.user.id : null,
    );
    return { message: '룰렛이 스핀되었습니다.', data };
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: '룰렛 이탈 처리 (Rage-quit)',
    description:
      'X 버튼 또는 카운트다운 00:00 도달 시 호출하여 남은 벌칙을 일괄 자동 공개합니다. remainingSpins>0일 때만 ' +
      '호출하세요(이미 전부 공개면 400). 처리 후 result:revealed 소켓이 방 전체로 발송됩니다. 회원·게스트 모두 Bearer JWT.',
  })
  @ApiParam({
    name: 'roomCode',
    description: '방 코드 (8자리)',
    example: 'V1StGXR8',
  })
  @ApiSuccessResponse(ExitRouletteResponseDto, {
    status: 201,
    description: '이탈 처리 성공',
  })
  @ApiResponse({
    status: 401,
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiResponse({
    status: 400,
    description: '멤버 정보를 찾을 수 없거나 이미 처리 완료되었습니다.',
  })
  @Post(':roomCode/roulette/exit')
  @UseGuards(AuthGuard('jwt'))
  async exitRoulette(
    @Param('roomCode') roomCode: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const isGuest = req.user.role === 'guest';
    const data = await this.rouletteService.exitRoulette(
      roomCode,
      isGuest ? null : req.user.id,
      isGuest ? req.user.id : null,
    );
    return { message: '룰렛이 처리되었습니다.', data };
  }
}
