import { IsOptional, IsString, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ 
    description: '변경할 닉네임 (2자 이상 20자 이하)', 
    example: '새닉네임' 
  })
  @IsOptional()
  @IsString()
  @Length(2, 20, { message: '닉네임은 2자 이상 20자 이하이어야 합니다.' })
  nickname?: string;

  @ApiPropertyOptional({ 
    description: '서비스 제공 기본 이미지 셋 키값 (업로드 불가)', 
    example: 'basic_image_key_05' 
  })
  @IsOptional()
  @IsString()
  profileImage?: string;
}