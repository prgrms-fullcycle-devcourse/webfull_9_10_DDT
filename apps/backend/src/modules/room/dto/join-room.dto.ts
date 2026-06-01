import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class JoinRoomDto {
  @ApiProperty({ example: '1234', description: '방 비밀번호' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ example: '집중왕', description: '방에서 사용할 닉네임' })
  @IsString()
  @IsNotEmpty()
  nickname!: string;

  @ApiProperty({
    example: 'basic_image_key_01',
    description: '프로필 이미지 키값',
  })
  @IsString()
  @IsNotEmpty()
  profileImage!: string;
}
