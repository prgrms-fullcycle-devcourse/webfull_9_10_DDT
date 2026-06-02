import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SpinRouletteDto {
  @ApiProperty({
    description:
      '전역 스핀 순번(1부터 remainingSpins까지). content 오름차순을 count만큼 펼친 ' +
      '인스턴스 순번이며, 1부터 순차 증가시켜 보냅니다. 마지막 순번(= count 총합)에서 ' +
      '전체 공개 + result:revealed 브로드캐스트가 발생합니다. 범위를 벗어나면 400, ' +
      '이미 전부 공개된 뒤 재호출 시 409.',
    example: 1,
  })
  @IsInt({ message: '스핀 인덱스는 정수여야 합니다.' })
  @Min(1, { message: '스핀 인덱스는 1 이상이어야 합니다.' })
  spinIndex!: number;
}

export class SpinRouletteResponseDto {
  @ApiProperty({ example: 1 })
  spinIndex!: number;

  @ApiProperty({
    example: 'a1b2c3d4-...',
    nullable: true,
    type: String,
    description:
      '휠 정지 위치 매핑용 PENALTY_ITEM.id (풀에 없으면 null, 풀 내 동일 content 중복 시 첫 항목 기준)',
  })
  penaltyItemId!: string | null;

  @ApiProperty({ example: '팔굽혀펴기 10회' })
  penaltyContent!: string;

  @ApiProperty({
    example: 2,
    description:
      '남은 스핀 수(미공개 벌칙 count 합산). 매 호출 1씩 감소, 0이면 종료.',
  })
  remainingSpins!: number;

  @ApiProperty({
    example: false,
    description:
      '모든 기회 소진 여부. true(또는 remainingSpins=0)면 룰렛 종료 → "다른 멤버 벌칙 보기" 전환·결과 페이지 이동.',
  })
  isFinished!: boolean;
}

export class RevealedPenaltyDto {
  @ApiProperty({ example: 'a1b2c3d4-...', nullable: true, type: String })
  id!: string | null;

  @ApiProperty({ example: '팔굽혀펴기 10회' })
  content!: string;

  @ApiProperty({ example: 1 })
  count!: number;
}

export class ExitRouletteResponseDto {
  @ApiProperty({ example: true })
  autoRevealed!: boolean;

  @ApiProperty({
    type: [RevealedPenaltyDto],
    description: '이번에 자동 공개된 벌칙',
  })
  revealedPenalties!: RevealedPenaltyDto[];
}
