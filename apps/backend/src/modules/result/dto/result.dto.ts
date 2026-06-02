import { ApiProperty } from '@nestjs/swagger';

export class ResultPenaltyItemDto {
  @ApiProperty({ example: '팔굽혀펴기 10회' })
  content!: string;

  @ApiProperty({ example: 1 })
  count!: number;
}

export class ResultMemberPenaltiesDto {
  @ApiProperty({
    example: 1,
    description:
      '배정된 전체 벌칙 수(미공개 포함). ' +
      '0이면 벌칙 없음(All Clear/tier1). ' +
      '0보다 크면 벌칙이 배정된 것이며 items가 []여도 미공개 상태임',
  })
  totalCount!: number;

  @ApiProperty({
    type: [ResultPenaltyItemDto],
    description:
      '공개된 벌칙 목록. 미공개 벌칙은 보안상 content 미반환(core-rules §1.7). ' +
      '[]이어도 totalCount > 0이면 벌칙이 배정된 것 — remainingSpins > 0이면 룰렛 진행 필요. ' +
      '[]이고 totalCount === 0이면 실제로 벌칙 없음',
  })
  items!: ResultPenaltyItemDto[];
}

export class ResultMemberDto {
  @ApiProperty({ example: 'uuid' })
  memberId!: string;

  @ApiProperty({ example: 'user-uuid', nullable: true, type: String })
  userId!: string | null;

  @ApiProperty({ example: '집중왕' })
  nickname!: string;

  @ApiProperty({
    example: 'https://example.com/p.png',
    nullable: true,
    type: String,
  })
  profileImage!: string | null;

  @ApiProperty({ example: false })
  isHost!: boolean;

  @ApiProperty({ example: true })
  isLoggedIn!: boolean;

  @ApiProperty({ example: 1, description: '이탈 시간 기준 순위' })
  rank!: number;

  @ApiProperty({
    example: 60000,
    description:
      '총 이탈 시간(ms). 포기자(gaveUpAt≠null)는 포기~세션종료 잔여시간이 합산됨',
  })
  totalEscapeMs!: number;

  @ApiProperty({
    example: 1,
    description: '벌칙 등급(0=All Clear). 포기자는 최고 등급 강제',
  })
  penaltyTier!: number;

  @ApiProperty({ example: false })
  isAllClear!: boolean;

  @ApiProperty({
    example: 1,
    description:
      '공개된 벌칙 수(count 합계). 미공개분 미포함 — 전체 배정 수는 penalties.totalCount 참조',
  })
  penaltyCount!: number;

  @ApiProperty({
    example: 0,
    description:
      '남은 룰렛 스핀 수(미공개 벌칙 count 합산, 중복 포함). 0이면 룰렛 스킵',
  })
  remainingSpins!: number;

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
    format: 'date-time',
  })
  gaveUpAt!: Date | null;

  @ApiProperty({
    type: ResultMemberPenaltiesDto,
    description:
      '벌칙 목록 및 상태. ' +
      'items=[]이어도 totalCount > 0이면 미공개 상태(보안규칙). ' +
      '포기자/최고등급은 룰렛 없이 즉시 공개되어 items에 바로 포함됨(remainingSpins=0)',
  })
  penalties!: ResultMemberPenaltiesDto;
}

export class ResultRulePenaltyDto {
  @ApiProperty({ example: 'uuid' })
  itemId!: string;

  @ApiProperty({ example: '팔굽혀펴기 10회' })
  content!: string;
}

export class ResultRuleDto {
  @ApiProperty({ example: 25 })
  focusMin!: number;

  @ApiProperty({ example: 5 })
  breakMin!: number;

  @ApiProperty({ example: 4 })
  rounds!: number;

  @ApiProperty({
    type: [ResultRulePenaltyDto],
    description:
      '벌칙 풀(공개). 룰렛 휠 항목을 이 목록으로 구성. 본인 미공개 벌칙 content는 멤버 penalties에 오지 않음(count만).',
  })
  penalties!: ResultRulePenaltyDto[];

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: '티어 설정 JSON',
  })
  tierConfig!: Record<string, unknown>;
}

export class ResultResponseDto {
  @ApiProperty({ example: 'V1StGXR8' })
  roomCode!: string;

  @ApiProperty({ example: '스터디방' })
  roomTitle!: string;

  @ApiProperty({
    example: 7200000,
    nullable: true,
    type: Number,
    description: '총 세션 시간(ms)',
  })
  totalSessionMs!: number | null;

  @ApiProperty({
    example: '2026-05-29T01:00:00.000Z',
    format: 'date-time',
    description: '서버 현재 시각(클라 시계 보정용)',
  })
  serverTime!: Date;

  @ApiProperty({
    example: '2026-05-29T01:10:00.000Z',
    nullable: true,
    type: String,
    format: 'date-time',
    description:
      '룰렛 카운트다운 종료 시각(절대 ISO, "초" 아님). 남은초 = max(0,(rouletteEndsAt-serverTime)/1000)로 FE 계산. ' +
      '00:00 도달 시 POST /roulette/exit 호출. (현재 제한 10분은 임시값, 정책 미확정) null이면 미정.',
  })
  rouletteEndsAt!: Date | null;

  @ApiProperty({
    example: 4,
    nullable: true,
    type: Number,
    description:
      '현재는 계획 라운드 수(계약서 rounds). force-end 시 실제 완수 라운드와 다를 수 있음(추후 보정 예정).',
  })
  completedRounds!: number | null;

  @ApiProperty({ example: 2, description: '벌칙 대상 인원수' })
  penaltyMemberCount!: number;

  @ApiProperty({ example: false })
  allClear!: boolean;

  @ApiProperty({ type: [ResultMemberDto] })
  members!: ResultMemberDto[];

  @ApiProperty({ type: ResultRuleDto, nullable: true })
  rule!: ResultRuleDto | null;
}
