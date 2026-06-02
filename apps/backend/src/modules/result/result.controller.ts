import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ResultService } from './result.service';
import { ResultResponseDto } from './dto/result.dto';
import { ApiSuccessResponse } from '../../common/swagger/api-success-response.decorator';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
}

@ApiTags('Result API (결과 조회)')
@Controller('rooms')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @ApiBearerAuth()
  @ApiOperation({
    summary: '결과 화면 조회',
    description:
      '세션 종료(result phase) 후 멤버별 이탈 시간·순위·벌칙 결과를 조회합니다. 룰렛 카운트다운은 ' +
      'rouletteEndsAt(절대 ISO) - serverTime으로 계산하세요. 벌칙 공개 실시간 동기화는 result:revealed 소켓 ' +
      '이벤트를 구독하세요(마지막 spin·exit·타임아웃 자동공개 3경로). 제한시간 경과 후 조회 시 서버가 미공개 벌칙을 자동 공개합니다.',
  })
  @ApiParam({
    name: 'roomCode',
    description: '방 코드 (8자리)',
    example: 'TESTROOM',
  })
  @ApiSuccessResponse(ResultResponseDto, {
    status: 200,
    description: '조회 성공',
  })
  @ApiResponse({
    status: 401,
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiResponse({
    status: 403,
    description:
      '해당 방의 멤버가 아니거나 아직 결과 단계(result phase)가 아닙니다.',
  })
  @ApiResponse({ status: 404, description: '결과를 찾을 수 없습니다.' })
  @ApiResponse({
    status: 500,
    description: '결과 데이터를 생성하는 중 오류가 발생했습니다.',
  })
  @Get(':roomCode/result')
  @UseGuards(AuthGuard('jwt'))
  async getResult(
    @Param('roomCode') roomCode: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const isGuest = req.user.role === 'guest';
    const data = await this.resultService.getResult(
      roomCode,
      isGuest ? null : req.user.id,
      isGuest ? req.user.id : null,
    );
    return {
      statusCode: 200,
      timestamp: new Date().toISOString(),
      path: `/rooms/${roomCode}/result`,
      message: '세션 결과를 조회했습니다.',
      data,
      error: null,
    };
  }
}
