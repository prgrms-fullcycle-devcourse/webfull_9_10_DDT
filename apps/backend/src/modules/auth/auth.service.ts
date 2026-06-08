import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../../common/redis/redis.service';
import { User } from '@prisma/client';

// 가입 시 랜덤 부여할 기본 프로필 이미지 풀 (user.service의 validProfileImages와 동일)
const PROFILE_IMAGE_KEYS = [
  'basic_image_key_01',
  'basic_image_key_02',
  'basic_image_key_03',
  'basic_image_key_04',
  'basic_image_key_05',
  'basic_image_key_06',
  'basic_image_key_07',
  'basic_image_key_08',
  'basic_image_key_09',
  'basic_image_key_10',
];

const getRandomProfileImage = () =>
  PROFILE_IMAGE_KEYS[Math.floor(Math.random() * PROFILE_IMAGE_KEYS.length)];

interface GoogleProfile {
  id: string;
  email: string;
  nickname: string;
}

interface JwtPayload {
  sub: string;
  exp: number;
}

interface AgreeTermsDto {
  termsOfService: boolean;
  privacyPolicy: boolean;
  ageVerification: boolean;
}

export interface GuestTokenResult {
  accessToken: string;
  guestToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async validateOAuthLogin(profile: GoogleProfile): Promise<User> {
    const { id, email, nickname } = profile;

    let user = await this.prisma.user.findFirst({
      where: { providerId: id, deletedAt: null },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          nickname: nickname || '수감자',
          provider: 'google',
          providerId: id,
          // 가입 시 최초 1회 프로필 이미지를 랜덤 부여한다.
          profileImage: getRandomProfileImage(),
          isTermsAgreed: false,
        },
      });
    }

    return user;
  }

  generateJwt(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: 'user',
      isTermsAgreed: user.isTermsAgreed,
    };
    return this.jwtService.sign(payload);
  }

  generateGuestToken(): GuestTokenResult {
    const guestId = `guest_${uuidv4()}`;
    const payload = { sub: guestId, role: 'guest' };

    return {
      accessToken: this.jwtService.sign(payload),
      guestToken: guestId,
    };
  }

  async agreeTerms(
    userId: string,
    termsDto: AgreeTermsDto,
  ): Promise<{ success: boolean }> {
    const { termsOfService, privacyPolicy, ageVerification } = termsDto;

    if (!termsOfService || !privacyPolicy || !ageVerification) {
      throw new BadRequestException('필수 약관에 동의해주세요.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('인증이 필요합니다.');
    }

    if (user.isTermsAgreed) {
      return { success: true };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isTermsAgreed: true },
    });

    return { success: true };
  }

  async logout(token: string): Promise<{ success: boolean }> {
    try {
      const decoded: unknown = this.jwtService.decode(token);

      if (
        !decoded ||
        typeof decoded !== 'object' ||
        !('exp' in decoded) ||
        typeof (decoded as Record<string, unknown>).exp !== 'number'
      ) {
        throw new UnauthorizedException();
      }

      const exp = (decoded as JwtPayload).exp;
      const expirationTime = exp - Math.floor(Date.now() / 1000);

      if (expirationTime > 0) {
        await this.redisService.instance.set(
          `blacklist:${token}`,
          'logout',
          'EX',
          expirationTime,
        );
      }
      return { success: true };
    } catch {
      throw new UnauthorizedException('유효하지 않은 인증 토큰입니다.');
    }
  }
}
