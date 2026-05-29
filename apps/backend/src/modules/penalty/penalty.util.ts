export type PenaltyTier = {
  tier: number;
  minPct: number;
  maxPct: number | null;
  count: number;
};

export type TierResult = {
  penaltyTier: number;
  penaltyCount: number;
  isForceAll: boolean;
};

/**
 * Prisma Json 타입 → PenaltyTier[] 변환 (런타임 검증)
 */
export function parseTierConfig(raw: unknown): PenaltyTier[] {
  const config = raw as { tiers?: unknown };
  if (!config?.tiers || !Array.isArray(config.tiers)) {
    throw new Error('tierConfig 형식이 올바르지 않습니다.');
  }
  return config.tiers as PenaltyTier[];
}

/**
 * 벌칙 산정 함수
 * @param totalEscapeMs 이탈 총 누적 시간(ms)
 * @param focusMin 회차당 집중 시간(분)
 * @param rounds 전체 라운드 수
 * @param tiers 티어 설정 객체 배열
 */
export function calculatePenaltyTier(
  totalEscapeMs: number,
  focusMin: number,
  rounds: number,
  tiers: PenaltyTier[],
): TierResult {
  // 1. All Clear 판정
  if (totalEscapeMs === 0) {
    return { penaltyTier: 0, penaltyCount: 0, isForceAll: false };
  }

  // 2. 이탈 비율 계산 (기획서 공식 적용)
  const totalFocusMs = focusMin * rounds * 60 * 1000;
  const escapePercent = (totalEscapeMs / totalFocusMs) * 100;

  // 3. 티어 정렬 (maxPct === null 티어는 항상 마지막)
  const sortedTiers = [...tiers].sort((a, b) => {
    if (a.maxPct === null) return 1;
    if (b.maxPct === null) return -1;
    return a.minPct - b.minPct;
  });

  for (const tier of sortedTiers) {
    // 최고 등급 (maxPct === null)인 경우
    if (tier.maxPct === null) {
      if (escapePercent >= tier.minPct) {
        return { penaltyTier: tier.tier, penaltyCount: tier.count, isForceAll: true };
      }
      continue;
    }

    // 일반 구간 (minPct <= x < maxPct)
    if (escapePercent >= tier.minPct && escapePercent < tier.maxPct) {
      return { penaltyTier: tier.tier, penaltyCount: tier.count, isForceAll: false };
    }
  }

  return { penaltyTier: 0, penaltyCount: 0, isForceAll: false };
}
