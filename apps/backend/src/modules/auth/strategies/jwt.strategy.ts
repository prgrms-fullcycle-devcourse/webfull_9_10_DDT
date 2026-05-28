import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
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
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<JwtUserResult> {
    const token = req.headers.authorization?.split(' ')[1];

    const isBlacklisted = await this.redisService.instance.get(
      `blacklist:${token}`,
    );
    if (isBlacklisted) {
      throw new UnauthorizedException('로그아웃 처리된 토큰입니다.');
    }

    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
