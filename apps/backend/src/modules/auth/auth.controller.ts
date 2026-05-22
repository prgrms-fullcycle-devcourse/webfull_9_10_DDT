import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 프론트엔드에서 버튼 클릭 시 진입하는 주소
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {
  }

  // 구글 인증 후 돌아오는 콜백 주소
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    const googleProfile = req.user;
    const user = await this.authService.validateOAuthLogin(googleProfile);
    const token = this.authService.generateJwt(user);

    const frontendUrl = process.env.FRONTEND_URL;

    const htmlResponse = `
      <html>
        <body>
          <script>
            // 부모 창으로 토큰 정보 전송
            window.opener.postMessage({ type: 'OAUTH_SUCCESS', token: '${token}' }, '${frontendUrl}');
            // 팝업창 닫기
            window.close();
          </script>
        </body>
      </html>
    `;

    res.send(htmlResponse);
  }
}