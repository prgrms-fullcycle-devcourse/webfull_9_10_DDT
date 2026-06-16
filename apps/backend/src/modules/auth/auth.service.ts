import {
  Injectable,
  BadRequestException,
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

/**
 * 가입 시 부여할 기본 프로필 이미지 키를 무작위로 하나 선택합니다.
 * @returns {string} PROFILE_IMAGE_KEYS 중 무작위로 뽑은 키 1개
 */
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
  jti: string;
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

  /**
   * 구글 프로필로 기존 회원을 조회하고, 없으면 신규 가입시킵니다.
   * @param {GoogleProfile} profile - 구글 OAuth가 전달한 프로필(id/email/nickname)
   * @returns {Promise<User>} 조회 또는 신규 생성된 사용자 엔티티
   */
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

  /**
   * 로그인 사용자용 JWT 액세스 토큰을 발급합니다.
   * @param {User} user - 토큰 페이로드에 담을 사용자 엔티티
   * @returns {string} 서명된 JWT 문자열
   */
  generateJwt(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: 'user',
      isTermsAgreed: user.isTermsAgreed,
      jti: uuidv4(),
    };
    return this.jwtService.sign(payload);
  }

  /**
   * 비회원(게스트)용 임시 JWT와 게스트 식별자를 발급합니다.
   * @returns {GuestTokenResult} accessToken(12h 만료)과 guestToken
   */
  generateGuestToken(): GuestTokenResult {
    const guestId = `guest_${uuidv4()}`;
    const payload = { sub: guestId, role: 'guest', jti: uuidv4() };

    return {
      // 게스트는 비영속 임시 참여자이므로 12시간 단기 만료로 제한
      accessToken: this.jwtService.sign(payload, { expiresIn: '12h' }),
      guestToken: guestId,
    };
  }

  /**
   * 필수 약관 3종 동의를 검증하고 사용자의 동의 상태를 갱신합니다.
   * @param {string} userId - 동의를 처리할 사용자 ID
   * @param {AgreeTermsDto} termsDto - 약관 동의 여부 플래그 묶음
   * @returns {Promise<{ success: boolean }>} 처리 성공 여부
   */
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

    // 이미 동의한 계정은 재호출돼도 멱등하게 성공 처리(중복 업데이트 방지)
    if (user.isTermsAgreed) {
      return { success: true };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isTermsAgreed: true },
    });

    return { success: true };
  }

  /**
   * JWT를 Redis 블랙리스트에 등록하여 만료 시점까지 무효화(로그아웃)합니다.
   * @param {string} token - 무효화할 JWT 문자열
   * @returns {Promise<{ success: boolean }>} 처리 성공 여부
   */
  async logout(token: string): Promise<{ success: boolean }> {
    try {
      const decoded: unknown = this.jwtService.decode(token);

      if (
        !decoded ||
        typeof decoded !== 'object' ||
        !('exp' in decoded) ||
        typeof (decoded as Record<string, unknown>).exp !== 'number' ||
        typeof (decoded as Record<string, unknown>).jti !== 'string'
      ) {
        throw new UnauthorizedException();
      }

      const exp = (decoded as JwtPayload).exp;
      const expirationTime = exp - Math.floor(Date.now() / 1000);
      const jti = (decoded as JwtPayload).jti;

      // 남은 만료 시간(초)만큼만 TTL을 잡아, 토큰 자연 만료 후 Redis에서 자동 정리되게 한다.
      if (expirationTime > 0) {
        await this.redisService.instance.set(
          `blacklist:${jti}`,
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
