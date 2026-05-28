import { Controller, Get, Param, Req, Headers } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ResultService } from './result.service';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request { user?: { id: string }; }

@ApiTags('Result API (결과 조회)')
@Controller('rooms')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Guest-Token', required: false })
  @ApiOperation({ summary: '결과 화면 조회' })
  @Get(':roomId/result')
  async getResult(
    @Param('roomId') roomId: string,
    @Req() req: AuthenticatedRequest,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const data = await this.resultService.getResult(roomId, req.user?.id, guestToken);
    return { message: '세션 결과를 조회했습니다.', data };
  }
}
