import {
  calculatePenaltyTier,
  parseTierConfig,
  resolveForfeitTier,
  type PenaltyTier,
} from './penalty.util';

// 기본 티어 매트릭스 (domain-rules §1)
const DEFAULT_TIERS: PenaltyTier[] = [
  { tier: 1, minPct: 0, maxPct: 10, count: 0 },
  { tier: 2, minPct: 10, maxPct: 30, count: 1 },
  { tier: 3, minPct: 30, maxPct: null, count: 2 },
];

const FOCUS_MIN = 25;
const ROUNDS = 4;
// 총 집중 시간 대비 이탈 비율(%)을 ms로 환산
const msFromPercent = (pct: number) =>
  Math.round((pct / 100) * FOCUS_MIN * ROUNDS * 60 * 1000);

describe('calculatePenaltyTier', () => {
  it('이탈 0 → tier 0 (All Clear)', () => {
    expect(calculatePenaltyTier(0, FOCUS_MIN, ROUNDS, DEFAULT_TIERS)).toEqual({
      penaltyTier: 0,
      penaltyCount: 0,
      isForceAll: false,
    });
  });

  it('5% → tier 1 (경고만, 벌칙 0개)', () => {
    expect(
      calculatePenaltyTier(msFromPercent(5), FOCUS_MIN, ROUNDS, DEFAULT_TIERS),
    ).toEqual({ penaltyTier: 1, penaltyCount: 0, isForceAll: false });
  });

  it('정확히 10% → tier 2 (minPct 포함 / maxPct 배타 경계)', () => {
    expect(
      calculatePenaltyTier(msFromPercent(10), FOCUS_MIN, ROUNDS, DEFAULT_TIERS),
    ).toEqual({ penaltyTier: 2, penaltyCount: 1, isForceAll: false });
  });

  it('20% → tier 2', () => {
    expect(
      calculatePenaltyTier(msFromPercent(20), FOCUS_MIN, ROUNDS, DEFAULT_TIERS),
    ).toEqual({ penaltyTier: 2, penaltyCount: 1, isForceAll: false });
  });

  it('정확히 30% → 최고 티어, 룰렛 진행(isForceAll=false)', () => {
    expect(
      calculatePenaltyTier(msFromPercent(30), FOCUS_MIN, ROUNDS, DEFAULT_TIERS),
    ).toEqual({ penaltyTier: 3, penaltyCount: 2, isForceAll: false });
  });

  it('150%(초과) → 최고 티어, 룰렛 진행(isForceAll=false)', () => {
    expect(
      calculatePenaltyTier(
        msFromPercent(150),
        FOCUS_MIN,
        ROUNDS,
        DEFAULT_TIERS,
      ),
    ).toEqual({ penaltyTier: 3, penaltyCount: 2, isForceAll: false });
  });

  it('정렬되지 않은 tiers 입력에도 동일 결과', () => {
    const shuffled: PenaltyTier[] = [
      DEFAULT_TIERS[2],
      DEFAULT_TIERS[0],
      DEFAULT_TIERS[1],
    ];
    expect(
      calculatePenaltyTier(msFromPercent(20), FOCUS_MIN, ROUNDS, shuffled),
    ).toEqual({ penaltyTier: 2, penaltyCount: 1, isForceAll: false });
  });
});

describe('resolveForfeitTier', () => {
  it('최고 등급(maxPct=null) 티어를 강제 부여하고 isForceAll=true', () => {
    expect(resolveForfeitTier(DEFAULT_TIERS)).toEqual({
      penaltyTier: 3,
      penaltyCount: 2,
      isForceAll: true,
    });
  });

  it('maxPct=null 티어가 없으면 throw', () => {
    const noTop: PenaltyTier[] = [
      { tier: 1, minPct: 0, maxPct: 100, count: 1 },
    ];
    expect(() => resolveForfeitTier(noTop)).toThrow();
  });
});

describe('parseTierConfig', () => {
  it('정상 형식 → tiers 배열 반환', () => {
    expect(parseTierConfig({ tiers: DEFAULT_TIERS })).toEqual(DEFAULT_TIERS);
  });

  it('null → throw', () => {
    expect(() => parseTierConfig(null)).toThrow();
  });

  it('tiers가 배열이 아니면 → throw', () => {
    expect(() => parseTierConfig({ tiers: 'not-array' })).toThrow();
  });

  it('tiers 키가 없으면 → throw', () => {
    expect(() => parseTierConfig({})).toThrow();
  });
});
