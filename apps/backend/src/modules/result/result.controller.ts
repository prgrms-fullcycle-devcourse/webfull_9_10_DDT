import { Controller, Get, Param, Req, Headers } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiHeader,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { ResultService } from './result.service';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
    user?: { id: string };
}

@ApiTags('Result API (결과 조회)')
@Controller('rooms')
export class ResultController {
    constructor(private readonly resultService: ResultService) {}

    @ApiBearerAuth()
    @ApiHeader({
        name: 'X-Guest-Token',
        required: false,
        description: '게스트 입장 시 발급받은 토큰 (회원은 생략)',
    })
    @ApiOperation({
        summary: '결과 화면 조회',
        description:
            '세션 종료(result phase) 후 멤버별 이탈 시간·순위·벌칙 결과를 조회합니다.',
    })
    @ApiParam({
        name: 'roomCode',
        description: '방 코드 (8자리)',
        example: 'V1StGXR8',
    })
    @ApiResponse({
        status: 200,
        description: '조회 성공',
        schema: {
            example: {
                statusCode: 200,
                timestamp: '2026-05-29T01:00:00.000Z',
                path: '/rooms/V1StGXR8/result',
                message: '세션 결과를 조회했습니다.',
                data: {
                    roomCode: 'V1StGXR8',
                    roomTitle: '스터디방',
                    totalSessionMs: 7200000,
                    completedRounds: 4,
                    penaltyMemberCount: 2,
                    allClear: false,
                    members: [
                        {
                            memberId: 'uuid',
                            nickname: '집중왕',
                            rank: 1,
                            totalEscapeMs: 60000,
                            penaltyTier: 1,
                            penaltyCount: 1,
                            isAllClear: false,
                            gaveUpAt: null,
                            penalties: {
                                totalCount: 1,
                                items: [{ content: '팔굽혀펴기 10회', count: 1 }],
                            },
                        },
                    ],
                    rule: {
                        focusMin: 25,
                        breakMin: 5,
                        rounds: 4,
                        penalties: [{ itemId: 'uuid', content: '팔굽혀펴기 10회' }],
                        tierConfig: {
                            tiers: [
                                { tier: 1, minPct: 0, maxPct: 10, count: 0 },
                                { tier: 2, minPct: 10, maxPct: 30, count: 1 },
                                { tier: 3, minPct: 30, maxPct: null, count: 3 },
                            ],
                        },
                    },
                },
                error: null,
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: '세션이 종료된 후 결과를 확인할 수 있습니다. (result phase 아님)',
    })
    @ApiResponse({ status: 404, description: '결과를 찾을 수 없습니다.' })
    @ApiResponse({ status: 500, description: '결과 데이터를 생성하는 중 오류가 발생했습니다.' })
    @Get(':roomCode/result')
    async getResult(
        @Param('roomCode') roomCode: string,
        @Req() req: AuthenticatedRequest,
        @Headers('x-guest-token') guestToken?: string,
    ) {
        const data = await this.resultService.getResult(
            roomCode,
            req.user?.id,
            guestToken,
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
