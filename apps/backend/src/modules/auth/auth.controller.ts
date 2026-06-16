import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AgreeTermsDto } from './dto/agree-terms.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
}
interface GoogleProfileRequest extends Request {
  user: { id: string; email: string; nickname: string };
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
    description:
      '프론트가 팝업으로 여는 진입점. 구글 동의 화면으로 리다이렉트됩니다.',
  })
  /** 구글 동의 화면으로 리다이렉트하는 진입점. 실제 처리는 passport 가드가 수행한다. */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {}

  @ApiOperation({
    summary: '구글 소셜 로그인 콜백',
    description:
      '구글 인증 완료 후 호출됩니다. 팝업을 닫고 postMessage(OAUTH_SUCCESS, token)로 프론트에 JWT를 전달합니다.',
  })
  /** 구글 인증 콜백. 팝업으로 JWT를 전달하거나, 팝업이 없으면 콜백 URL로 이동시킨다. */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(
    @Req() req: GoogleProfileRequest,
    @Res() res: Response,
  ): Promise<void> {
    const user = await this.authService.validateOAuthLogin(req.user);
    const token = this.authService.generateJwt(user);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const callbackUrl = `${frontendUrl}/auth/callback?token=${encodeURIComponent(token)}`;

    // 팝업(window.opener)이 살아있으면 postMessage로 토큰 전달 후 닫고,
    // 팝업이 닫혔으면 콜백 URL로 직접 이동시키는 폴백 처리
    res.send(`
      <html><body><script>
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'OAUTH_SUCCESS', token: '${token}' }, '${frontendUrl}');
          window.close();
        } else {
          window.location.replace('${callbackUrl}');
        }
      </script></body></html>
    `);
  }

  @ApiOperation({
    summary: '비회원(게스트) 토큰 발급',
    description: '로그인 없이 입장할 게스트에게 JWT와 guestToken을 발급합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '게스트 토큰 발급 성공',
    schema: {
      example: {
        statusCode: 201,
        message: '비회원 토큰이 발급되었습니다.',
        data: { accessToken: 'eyJ...', guestToken: 'guest_xxxx' },
        error: null,
      },
    },
  })
  /** 로그인 없이 입장할 게스트에게 임시 JWT와 guestToken을 발급한다. */
  @Post('guest')
  guestLogin() {
    return {
      message: '비회원 토큰이 발급되었습니다.',
      data: this.authService.generateGuestToken(),
    };
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: '회원가입 필수 약관 동의',
    description:
      '필수 약관 3종에 모두 동의해야 하며, 이미 동의한 계정은 409를 반환합니다.',
  })
  @ApiBody({ type: AgreeTermsDto })
  @ApiResponse({ status: 201, description: '약관 동의 완료' })
  @ApiResponse({ status: 400, description: '필수 약관에 동의해주세요.' })
  @ApiResponse({ status: 401, description: '인증이 필요합니다.' })
  @ApiResponse({
    status: 409,
    description: '이미 약관 동의가 완료된 계정입니다.',
  })
  /** 회원가입 필수 약관 동의를 처리한다. (JWT 인증 필요) */
  @UseGuards(AuthGuard('jwt'))
  @Post('terms')
  async agreeTerms(
    @Req() req: AuthenticatedRequest,
    @Body() body: AgreeTermsDto,
  ) {
    const data = await this.authService.agreeTerms(req.user.id, body);
    return { message: '약관 동의가 완료되었습니다.', data };
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: '로그아웃 (토큰 무효화)',
    description:
      '현재 JWT를 Redis 블랙리스트에 등록해 만료 시점까지 무효화합니다.',
  })
  @ApiResponse({ status: 200, description: '로그아웃 성공' })
  @ApiResponse({ status: 401, description: '유효하지 않은 인증 토큰입니다.' })
  /** 현재 JWT를 블랙리스트에 등록해 로그아웃 처리한다. (JWT 인증 필요) */
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Req() req: AuthenticatedRequest) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token)
      throw new UnauthorizedException('유효하지 않은 인증 토큰입니다.');

    const data = await this.authService.logout(token);
    return { message: '로그아웃이 완료되었습니다.', data };
  }
}
