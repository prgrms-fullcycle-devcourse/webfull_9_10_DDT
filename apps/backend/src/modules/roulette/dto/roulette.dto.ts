import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SpinRouletteDto {
  @ApiProperty({
    description:
      '전역 스핀 순번(1부터 remainingSpins까지). 벌칙을 count만큼 펼친 인스턴스 순번이며, ' +
      '서버가 member별 고정 seed로 무작위 순서로 노출합니다(같은 spinIndex는 항상 같은 벌칙). ' +
      '1부터 순차 증가시켜 보냅니다. 마지막 순번(= count 총합)에서 ' +
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

export class GiveUpPoolItemDto {
  @ApiProperty({ example: 'a1b2c3d4-1111' })
  itemId!: string;

  @ApiProperty({ example: '팔굽혀펴기 10회' })
  content!: string;
}

export class GiveUpPenaltyDto {
  @ApiProperty({
    example: 'a1b2c3d4-1111',
    nullable: true,
    type: String,
    description: '휠 정지 위치 매핑용 PENALTY_ITEM.id (풀에 없으면 null)',
  })
  itemId!: string | null;

  @ApiProperty({ example: '팔굽혀펴기 10회' })
  content!: string;

  @ApiProperty({ example: 2 })
  count!: number;
}

export class GiveUpRouletteResponseDto {
  @ApiProperty({
    example: '2026-06-05T10:30:00.000Z',
    type: String,
    description: '포기 시각(ISO). 룰렛 화면 상단 표기용 (10분 타이머 대체)',
  })
  gaveUpAt!: Date;

  @ApiProperty({
    example: 510000,
    description:
      '총 누적 이탈 시간(ms). 실제 이탈 로그 합산 + (계획 종료 시각 − gaveUpAt). ' +
      '통합결과 화면의 totalEscapeMs와 동일 값.',
  })
  totalEscapeMs!: number;

  @ApiProperty({
    type: [GiveUpPoolItemDto],
    description: '룰렛 휠 슬롯 구성용 전체 벌칙 후보(계약서 벌칙 풀)',
  })
  penaltyPool!: GiveUpPoolItemDto[];

  @ApiProperty({
    type: [GiveUpPenaltyDto],
    description:
      '확정 벌칙 목록(룰렛 정지 위치 + 하단 결과 표기용). forfeit 전체 공개.',
  })
  penalties!: GiveUpPenaltyDto[];

  @ApiProperty({
    example: '2026-06-05T10:40:00.000Z',
    type: String,
    nullable: true,
    description: '룰렛 제한 시간 만료 시각(ISO). gaveUpAt + 10분.',
  })
  rouletteEndsAt!: Date;

  @ApiProperty({
    example: '2026-06-05T10:30:05.000Z',
    type: String,
    description: '응답 생성 시각(ISO). 클라이언트 시간 보정용 서버 타임스탬프.',
  })
  serverTime!: Date;
}
