import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AgreeTermsDto } from './dto/agree-terms.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

interface GoogleProfileRequest extends Request {
  user: {
    id: string;
    email: string;
    nickname: string;
  };
}

@ApiTags('인증(Auth) API')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({
    summary: '구글 소셜 로그인 진입점',
    description: '프론트엔드에서 구글 로그인 창을 띄울 때 호출하는 API입니다.',
  })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {}

  @ApiOperation({
    summary: '구글 소셜 로그인 콜백',
    description:
      '구글 인증이 완료된 후 구글 서버가 백엔드로 리다이렉트하는 주소입니다. 팝업창을 닫고 프론트엔드로 토큰을 전송합니다.',
  })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(
    @Req() req: GoogleProfileRequest,
    @Res() res: Response,
  ): Promise<void> {
    const googleProfile = req.user;
    const user = await this.authService.validateOAuthLogin(googleProfile);
    const token = this.authService.generateJwt(user);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    const htmlResponse = `
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'OAUTH_SUCCESS', token: '${token}' }, '${frontendUrl}');
            window.close();
          </script>
        </body>
      </html>
    `;

    res.send(htmlResponse);
  }

  @ApiOperation({
    summary: '비회원(게스트) 토큰 발급',
    description:
      '로그인 없이 서비스를 이용하는 유저에게 게스트용 JWT 토큰과 식별자를 발급합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '비회원 토큰 발급 성공',
    schema: {
      example: {
        statusCode: 200,
        timestamp: '2026-05-22T10:00:00.000Z',
        path: '/auth/guest',
        message: '비회원 토큰이 발급되었습니다.',
        data: {
          accessToken: 'eyJhbGciOi...',
          guestToken: 'guest_550e8400-e29b-41d4-a716-446655440000',
        },
        error: null,
      },
    },
  })
  @Post('guest')
  guestLogin(): object {
    const result = this.authService.generateGuestToken();
    return {
      statusCode: 200,
      timestamp: new Date().toISOString(),
      path: '/auth/guest',
      message: '비회원 토큰이 발급되었습니다.',
      data: result,
      error: null,
    };
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: '회원가입 필수 약관 동의',
    description:
      '신규 가입 유저가 필수 약관 3종에 모두 동의했을 때 호출하여 DB 상태를 업데이트합니다.',
  })
  @ApiBody({ type: AgreeTermsDto })
  @ApiResponse({ status: 200, description: '약관 동의 완료' })
  @ApiResponse({
    status: 400,
    description: '필수 항목 미동의 (INVALID_REQUEST)',
  })
  @ApiResponse({
    status: 401,
    description: '인증 토큰 누락/만료 (UNAUTHORIZED)',
  })
  @ApiResponse({
    status: 409,
    description: '이미 약관 동의가 완료된 계정 (ALREADY_AGREED)',
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('terms')
  async agreeTerms(
    @Req() req: AuthenticatedRequest,
    @Body() body: AgreeTermsDto,
  ): Promise<object> {
    try {
      const data = await this.authService.agreeTerms(req.user.id, body);
      return {
        statusCode: 200,
        timestamp: new Date().toISOString(),
        path: '/auth/terms',
        message: '약관 동의가 완료되었습니다.',
        data,
        error: null,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new HttpException(
          {
            statusCode: 400,
            timestamp: new Date().toISOString(),
            path: '/auth/terms',
            message: '필수 약관에 동의해주세요.',
            data: null,
            error: 'INVALID_REQUEST',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (error instanceof ConflictException) {
        throw new HttpException(
          {
            statusCode: 409,
            timestamp: new Date().toISOString(),
            path: '/auth/terms',
            message: '이미 약관 동의가 완료된 계정입니다.',
            data: null,
            error: 'ALREADY_AGREED',
          },
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: '로그아웃 (토큰 무효화)',
    description:
      '현재 사용 중인 JWT 토큰을 Redis 블랙리스트에 등록하여 강제로 무효화시킵니다.',
  })
  @ApiResponse({ status: 200, description: '로그아웃 성공' })
  @ApiResponse({
    status: 401,
    description: '유효하지 않은 인증 토큰 (UNAUTHORIZED)',
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Req() req: AuthenticatedRequest): Promise<object> {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new UnauthorizedException();

      const data = await this.authService.logout(token);
      return {
        statusCode: 200,
        timestamp: new Date().toISOString(),
        path: '/auth/logout',
        message: '로그아웃이 완료되었습니다.',
        data,
        error: null,
      };
    } catch {
      throw new HttpException(
        {
          statusCode: 401,
          timestamp: new Date().toISOString(),
          path: '/auth/logout',
          message: '유효하지 않은 인증 토큰입니다.',
          data: null,
          error: 'UNAUTHORIZED',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
  @Get('test-token')
  testToken() {
    const fakeUser = {
      id: 'test-user-id-1234',
      nickname: 'fakeUser',
      email: 'test@test.com',
      isTermsAgreed: true,
      provider: '',
      providerId: '',
      profileImage: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return { token: this.authService.generateJwt(fakeUser) };
  }
}
