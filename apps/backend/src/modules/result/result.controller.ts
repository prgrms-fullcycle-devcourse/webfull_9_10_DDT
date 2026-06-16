import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResultService } from './result.service';
import { ResultResponseDto } from './dto/result.dto';
import { ApiSuccessResponse } from '../../common/swagger/api-success-response.decorator';

@ApiTags('Result API (결과 조회)')
@Controller('rooms')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @ApiOperation({
    summary: '결과 화면 조회',
    description:
      '세션 종료(result phase) 후 멤버별 이탈 시간·순위·벌칙 결과를 조회합니다. (로그인 불필요)',
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
    status: 403,
    description: '아직 결과 단계(result phase)가 아닙니다.',
  })
  @ApiResponse({ status: 404, description: '결과를 찾을 수 없습니다.' })
  @ApiResponse({
    status: 500,
    description: '결과 데이터를 생성하는 중 오류가 발생했습니다.',
  })
  @Get(':roomCode/result')
  async getResult(@Param('roomCode') roomCode: string) {
    const data = await this.resultService.getResult(roomCode);
    return {
      statusCode: 200,
      timestamp: new Date().toISOString(),
      path: `/rooms/${roomCode}/result`,
      message: '수감 결과를 조회했습니다.',
      data,
      error: null,
    };
  }
}
