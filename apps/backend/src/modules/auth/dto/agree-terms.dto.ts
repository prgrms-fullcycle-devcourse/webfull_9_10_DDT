import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class AgreeTermsDto {
  @ApiProperty({
    description: '서비스 이용약관 동의 여부',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  termsOfService: boolean;

  @ApiProperty({
    description: '개인정보 수집·이용 동의 여부',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  privacyPolicy: boolean;

  @ApiProperty({
    description: '만 14세 이상 확인 여부',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  ageVerification: boolean;
}