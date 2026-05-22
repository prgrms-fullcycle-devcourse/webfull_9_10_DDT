import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async validateOAuthLogin(profile: any) {
    const { id, email, nickname } = profile;

    // 아이디 중복 방지 위해 검색
    let user = await this.prisma.user.findFirst({
      where: { providerId: id },
    });

    // 회원가입
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: email,
          nickname: nickname || '수감자',
          provider: 'google',
          providerId: id,
          profileImage: 'DEFAULT_PROFILE_1', 
        },
      });
    }

    return user;
  }

  generateJwt(user: any) {
    const payload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload);
  }
}