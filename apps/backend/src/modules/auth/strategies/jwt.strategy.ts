import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  exp: number;
  jti: string;
}

interface JwtUserResult {
  id: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * JWT 검증 단계에서 호출되어, 블랙리스트(로그아웃) 여부까지 확인 후 사용자 정보를 반환합니다.
   * @param {JwtPayload} payload - 서명 검증을 통과한 JWT 페이로드
   * @returns {Promise<JwtUserResult>} 요청 컨텍스트에 주입될 사용자 정보
   */
  async validate(payload: JwtPayload): Promise<JwtUserResult> {
    // 로그아웃 시 jti가 블랙리스트에 등록되므로, 만료 전이라도 무효 토큰으로 거른다.
    const isBlacklisted = await this.redisService.instance.get(
      `blacklist:${payload.jti}`,
    );
    if (isBlacklisted) {
      throw new UnauthorizedException('로그아웃 처리된 토큰입니다.');
    }

    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
