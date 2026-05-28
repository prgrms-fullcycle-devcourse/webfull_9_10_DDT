import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';

@ApiTags('헬스체크(Health) API')
@Controller('health')
export class HealthController {
  @ApiOperation({
    summary: '헬스체크',
    description: 'Render 인스턴스 휴면 방지용 ping 엔드포인트입니다.',
  })
  @ApiResponse({ status: 200, description: '서버 정상 동작' })
  @Get()
  check(@Req() req: Request): object {
    const now = new Date().toISOString();
    return {
      statusCode: 200,
      timestamp: now,
      path: req.path,
      message: '서버가 정상적으로 동작 중입니다.',
      data: { status: 'ok', timestamp: now },
      error: null,
    };
  }
}
