import { Controller, Get, Patch, Delete, Body, Query, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { UsersService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@ApiTags('Users (사용자)')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: '내 정보 조회', description: '로그인 유저의 닉네임, 이메일, 프로필 이미지 정보를 조회합니다.' })
  @ApiResponse({
    status: 200,
    description: '성공',
    schema: {
      example: {
        message: '내 정보를 조회했습니다.',
        data: {
          userId: 'user_id',
          nickname: '김철수',
          email: 'user@gmail.com',
          profileImage: 'basic_image_key_03'
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: '유효하지 않은 인증 토큰입니다.' })
  @ApiResponse({ status: 404, description: '존재하지 않는 사용자입니다.' })
  async getMe(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    const data = await this.usersService.getMe(userId);
    return { message: '내 정보를 조회했습니다.', data };
  }

  @Patch('me')
  @ApiOperation({ summary: '내 정보 수정', description: '로그인 유저의 닉네임 또는 프로필 이미지를 수정합니다. (기본 이미지 키값만 허용)' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: '성공',
    schema: {
      example: {
        message: '내 정보가 수정되었습니다.',
        data: {
          userId: 'user_id',
          nickname: '새닉네임',
          profileImage: 'basic_image_key_05'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: '유효하지 않은 프로필 이미지입니다.' })
  async updateMe(@Req() req: AuthenticatedRequest, @Body() updateUserDto: UpdateUserDto) {
    const userId = req.user.id;
    const data = await this.usersService.updateMe(userId, updateUserDto);
    return { message: '내 정보가 수정되었습니다.', data };
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '회원 탈퇴', description: '로그인 유저가 서비스를 탈퇴합니다. (현재 방에 참여 중이면 탈퇴 불가)' })
  @ApiResponse({
    status: 200,
    description: '성공',
    schema: {
      example: {
        message: '회원 탈퇴가 완료되었습니다.',
        data: { success: true }
      }
    }
  })
  @ApiResponse({ status: 400, description: '방 참여 중에는 탈퇴할 수 없습니다.' })
  async deleteMe(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    const data = await this.usersService.deleteMe(userId);
    return { message: '회원 탈퇴가 완료되었습니다.', data };
  }

  @Get('me/history')
  @ApiOperation({ summary: '내가 참여한 방 히스토리', description: '로그인 유저가 참여한 방(세션) 목록을 페이지네이션으로 조회합니다.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '페이지 번호 (기본값: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지당 개수 (기본값: 10)' })
  @ApiResponse({
    status: 200,
    description: '성공',
    schema: {
      example: {
        message: '이력을 조회했습니다.',
        data: {
          total: 25,
          page: 1,
          sessions: [
            {
              roomId: 'uuid-string',
              roomTitle: '스터디 뽀모도로',
              profileImage: 'char_03',
              totalEscapeMs: 60000,
              penaltyTier: 1,
              memberCount: 4,
              endedAt: '2026-05-21T12:00:00.000Z'
            }
          ]
        }
      }
    }
  })
  async getMyHistory(
    @Req() req: AuthenticatedRequest,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const userId = req.user.id;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const data = await this.usersService.getMyHistory(userId, pageNum, limitNum);
    return { message: '이력을 조회했습니다.', data };
  }

  @Get('me/stats')
  @ApiOperation({ summary: '내 통계 조회', description: '로그인 유저의 누적 집중 시간, 이탈 횟수 등 통계를 조회합니다.' })
  @ApiResponse({
    status: 200,
    description: '성공',
    schema: {
      example: {
        message: '통계를 조회했습니다.',
        data: {
          totalRoomCount: 15,
          totalFocusMs: 90000000,
          totalEscapeMs: 3600000,
          totalEscapeCount: 12
        }
      }
    }
  })
  async getMyStats(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    const data = await this.usersService.getMyStats(userId);
    return { message: '통계를 조회했습니다.', data };
  }
}