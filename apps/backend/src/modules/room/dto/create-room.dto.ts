import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: '스터디방', description: '방 이름 (최대 20자)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  title!: string;

  @ApiProperty({ example: '1234', description: '방 비밀번호 (4~20자)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(20)
  password!: string;

  @ApiProperty({
    example: '집중왕',
    description: '방장이 방에서 사용할 닉네임',
  })
  @IsString()
  @IsNotEmpty()
  nickname!: string;

  @ApiProperty({
    example: 'basic_image_key_01',
    description: '방장 프로필 이미지 키값',
  })
  @IsString()
  @IsNotEmpty()
  profileImage!: string;
}
