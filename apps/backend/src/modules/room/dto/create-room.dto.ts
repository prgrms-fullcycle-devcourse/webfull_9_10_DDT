import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

// create-room.dto.ts
export class CreateRoomDto {
  @ApiProperty({ example: '스터디방', description: '방 이름' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  title!: string;

  @ApiProperty({ example: '1234', description: '비밀번호' })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(20)
  password!: string;

  @IsString()
  @IsNotEmpty()
  nickname!: string;

  @IsString()
  @IsNotEmpty()
  profileImage!: string;
}
