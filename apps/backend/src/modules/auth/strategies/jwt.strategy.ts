import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis'; 
import Redis from 'ioredis';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly redis: Redis;

  constructor(
    private readonly redisService: RedisService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
      passReqToCallback: true, 
    });
    
    this.redis = this.redisService.getOrThrow();
  }

  async validate(req: any, payload: any) {
    const token = req.headers.authorization?.split(' ')[1];
    
    const isBlacklisted = await this.redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('로그아웃 처리된 토큰입니다.');
    }

    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}