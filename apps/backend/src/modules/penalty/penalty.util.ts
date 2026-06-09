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

/** 이탈 비율로 벌칙 등급·개수를 산정한다. */
export function calculatePenaltyTier(
  totalEscapeMs: number,
  focusMin: number,
  rounds: number,
  tiers: PenaltyTier[],
): TierResult {
  // 총 집중 시간이 0이면 비율 산정 불가 → 0 나눗셈 방지 안전 처리.
  // (이탈 0% 프리패스 폐지: escapePercent === 0도 일반 순회로 최저 구간에 매칭한다.)
  const totalFocusMs = focusMin * rounds * 60 * 1000;
  if (totalFocusMs <= 0) {
    return { penaltyTier: 0, penaltyCount: 0, isForceAll: false };
  }

  const escapePercent = (totalEscapeMs / totalFocusMs) * 100;

  // 3. 티어 정렬 (maxPct === null 티어는 항상 마지막)
  const sortedTiers = [...tiers].sort((a, b) => {
    if (a.maxPct === null) return 1;
    if (b.maxPct === null) return -1;
    return a.minPct - b.minPct;
  });

  for (const tier of sortedTiers) {
    // maxPct=null: 최상단 구간. resolveForfeitTier와 달리 isForceAll=false.
    if (tier.maxPct === null) {
      if (escapePercent >= tier.minPct) {
        return {
          penaltyTier: tier.tier,
          penaltyCount: tier.count,
          isForceAll: false,
        };
      }
      continue;
    }

    if (escapePercent >= tier.minPct && escapePercent < tier.maxPct) {
      return {
        penaltyTier: tier.tier,
        penaltyCount: tier.count,
        isForceAll: false,
      };
    }
  }

  return { penaltyTier: 0, penaltyCount: 0, isForceAll: false };
}

/**
 * 중도 포기자(탈주) 강제 산정: 최고 등급(maxPct === null) 티어 부여.
 * 룰렛 생략·전체 강제 공개(isForceAll).
 */
export function resolveForfeitTier(tiers: PenaltyTier[]): TierResult {
  const topTier = tiers.find((t) => t.maxPct === null);
  if (!topTier) {
    throw new Error('최고 등급(maxPct=null) 티어가 없습니다.');
  }
  return {
    penaltyTier: topTier.tier,
    penaltyCount: topTier.count,
    isForceAll: true,
  };
}

export function getEffectiveFocusEscapeMs(
  escapedAtMs: number,
  returnedAtMs: number,
  sessionStartMs: number,
  focusMin: number,
  breakMin: number,
  rounds: number,
): number {
  let overlapMs = 0;
  const cycleMs = (focusMin + breakMin) * 60 * 1000;
  const focusMs = focusMin * 60 * 1000;
  for (let i = 0; i < rounds; i++) {
    const focusStart = sessionStartMs + i * cycleMs;
    const focusEnd = focusStart + focusMs;
    const overlapStart = Math.max(escapedAtMs, focusStart);
    const overlapEnd = Math.min(returnedAtMs, focusEnd);
    if (overlapStart < overlapEnd) overlapMs += overlapEnd - overlapStart;
  }
  return overlapMs;
}

export function mergeIntervals(
  intervals: { start: number; end: number }[],
): { start: number; end: number }[] {
  if (intervals.length <= 1) return intervals;
  intervals.sort((a, b) => a.start - b.start);
  const merged = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    if (intervals[i].start <= last.end) {
      last.end = Math.max(last.end, intervals[i].end);
    } else {
      merged.push(intervals[i]);
    }
  }
  return merged;
}
