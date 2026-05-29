import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { JoinRoomDto } from './dto/join-room.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
}

@ApiTags('Room API')
@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @ApiBearerAuth()
  @ApiOperation({
    summary: '방 생성 (로그인 유저 전용)',
    description:
      '로그인 유저가 새 방을 생성합니다. 방의 식별자는 8자리 `code`이며, 코드가 중복되면 서버가 최대 5회까지 자동 재발급을 재시도합니다. 게스트는 생성할 수 없습니다.',
  })
  @ApiBody({ type: CreateRoomDto })
  @ApiResponse({
    status: 201,
    description: '방 생성 성공',
    schema: {
      example: {
        statusCode: 201,
        message: '요청이 성공적으로 처리되었습니다.',
        data: { code: 'V1StGXR8', url: 'https://ddt.app/room/V1StGXR8' },
        error: null,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '인증 토큰이 없거나 유효하지 않습니다.',
  })
  @ApiResponse({
    status: 403,
    description: '게스트는 방을 생성할 수 없습니다.',
  })
  @ApiResponse({
    status: 409,
    description: '방 코드 생성 실패 (재시도 횟수 초과).',
  })
  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() createRoomDto: CreateRoomDto,
  ) {
    if (req.user.role === 'guest') {
      throw new ForbiddenException('로그인이 필요합니다.');
    }
    return this.roomService.create(createRoomDto, req.user.id);
  }

  @ApiOperation({
    summary: '방 코드로 방 정보 조회',
    description:
      '방 코드로 방 기본 정보를 조회합니다. 종료된 방(result/closed)은 조회할 수 없습니다.',
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
        message: '요청이 성공적으로 처리되었습니다.',
        data: {
          title: '스터디방',
          id: 'V1StGXR8',
          memberCount: 3,
          phase: 'lobby',
        },
        error: null,
      },
    },
  })
  @ApiResponse({ status: 403, description: '종료된 방입니다.' })
  @ApiResponse({ status: 404, description: '존재하지 않는 방입니다.' })
  @Get(':roomCode')
  async findById(@Param('roomCode') roomCode: string) {
    return this.roomService.find(roomCode);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: '방 코드로 방 입장',
    description:
      '방 코드로 입장합니다. 비밀번호가 일치해야 하며, 재입장이 아닌 경우 정원(10명)과 진행 상태(timer)를 검사합니다.',
  })
  @ApiParam({
    name: 'roomCode',
    description: '방 코드 (8자리)',
    example: 'V1StGXR8',
  })
  @ApiBody({ type: JoinRoomDto })
  @ApiResponse({
    status: 201,
    description: '입장 성공',
    schema: {
      example: {
        statusCode: 201,
        message: '요청이 성공적으로 처리되었습니다.',
        data: { id: 'V1StGXR8', isReturning: false },
        error: null,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '닉네임 누락 등 잘못된 요청입니다.',
  })
  @ApiResponse({
    status: 401,
    description: '비밀번호 불일치 또는 토큰 오류입니다.',
  })
  @ApiResponse({ status: 403, description: '강퇴/진행 중/종료된 방입니다.' })
  @ApiResponse({ status: 404, description: '존재하지 않는 방입니다.' })
  @ApiResponse({ status: 409, description: '방이 가득 찼습니다.' })
  @Post(':roomCode')
  @UseGuards(AuthGuard('jwt'))
  async joinById(
    @Param('roomCode') roomCode: string,
    @Body() joinRoomDto: JoinRoomDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const isGuest = req.user.role === 'guest';
    return this.roomService.join(
      roomCode,
      joinRoomDto,
      isGuest ? null : req.user.id,
      isGuest ? req.user.id : null,
    );
  }
}
