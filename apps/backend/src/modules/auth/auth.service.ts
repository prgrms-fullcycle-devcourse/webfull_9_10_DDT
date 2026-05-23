import { 
  Injectable, 
  BadRequestException, 
  ConflictException, 
  UnauthorizedException 
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '@liaoliaots/nestjs-redis'; 
import Redis from 'ioredis';

@Injectable()
export class AuthService {
  private readonly redis: Redis; 

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService 
  ) {
    this.redis = this.redisService.getOrThrow();
  }

  async validateOAuthLogin(profile: any) {
    const { id, email, nickname } = profile;

    let user = await this.prisma.user.findFirst({
      where: { providerId: id },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: email,
          nickname: nickname || '수감자',
          provider: 'google',
          providerId: id,
          profileImage: 'DEFAULT_PROFILE_1', 
          isTermsAgreed: false,
        },
      });
    }

    return user;
  }

  generateJwt(user: any) {
    const payload = { sub: user.id, email: user.email, role: 'user' };
    return this.jwtService.sign(payload);
  }

  generateGuestToken() {
    const guestId = `guest_${uuidv4()}`;
    const payload = { sub: guestId, role: 'guest' };
    
    return {
      accessToken: this.jwtService.sign(payload),
      guestToken: guestId, 
    };
  }

  async agreeTerms(userId: string, termsDto: any) {
    const { termsOfService, privacyPolicy, ageVerification } = termsDto;

    if (!termsOfService || !privacyPolicy || !ageVerification) {
      throw new BadRequestException('필수 약관에 동의해주세요.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('인증이 필요합니다.');
    }

    if (user.isTermsAgreed) {
      throw new ConflictException('이미 약관 동의가 완료된 계정입니다.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isTermsAgreed: true },
    });

    return { success: true };
  }

  async logout(token: string) {
    try {
      const decoded: any = this.jwtService.decode(token);
      if (!decoded || !decoded.exp) throw new UnauthorizedException();

      const expirationTime = decoded.exp - Math.floor(Date.now() / 1000);
      
      if (expirationTime > 0) {
        await this.redis.set(`blacklist:${token}`, 'logout', 'EX', expirationTime);
      }
      return { success: true };
    } catch (error) {
      throw new UnauthorizedException('유효하지 않은 인증 토큰입니다.');
    }
  }
}