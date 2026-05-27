import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SpinRouletteDto {
  @ApiProperty({ 
    description: '스핀할 룰렛의 인덱스 (1부터 시작)', 
    example: 1 
  })
  @IsInt({ message: '스핀 인덱스는 정수여야 합니다.' })
  @Min(1, { message: '스핀 인덱스는 1 이상이어야 합니다.' })
  spinIndex!: number;
}