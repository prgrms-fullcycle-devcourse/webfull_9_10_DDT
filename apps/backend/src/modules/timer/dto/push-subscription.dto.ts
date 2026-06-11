import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';
import type { PushSubscription } from 'web-push';

export class SavePushSubscriptionDto {
  @ApiPropertyOptional({
    description: '안드로이드 등 네이티브 앱에서 발급받은 푸시 토큰 (문자열)',
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({
    description: 'PWA 등 브라우저 기반의 푸시 구독 객체',
  })
  @IsOptional()
  @IsObject()
  subscription?: PushSubscription;

  @ApiProperty({
    description: '클라이언트 플랫폼 구분 (web, android, ios)',
    example: 'android',
  })
  @IsString()
  platform!: string;
}