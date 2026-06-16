import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface GoogleProfile {
  id: string;
  displayName: string;
  emails: { value: string }[];
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') as string,
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') as string,
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') as string,
      scope: ['email', 'profile'],
    });
  }

  /**
   * 구글 OAuth 인증 성공 시 호출되어, 후속 처리에 쓸 사용자 정보를 정규화합니다.
   * @param {string} _accessToken - 구글 액세스 토큰(미사용)
   * @param {string} _refreshToken - 구글 리프레시 토큰(미사용)
   * @param {GoogleProfile} profile - 구글이 내려준 원본 프로필
   * @param {VerifyCallback} done - 정규화된 사용자 정보를 넘길 콜백
   * @returns {void}
   */
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: GoogleProfile,
    done: VerifyCallback,
  ): void {
    const { id, displayName, emails } = profile;
    done(null, {
      id,
      email: emails[0].value,
      nickname: displayName,
    });
  }
}
