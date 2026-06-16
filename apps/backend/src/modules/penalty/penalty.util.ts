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
 * 계약서에 저장된 tierConfig(JSON)를 벌칙 등급 배열로 변환합니다.
 * Prisma의 Json 타입은 형식이 보장되지 않으므로 런타임에서 구조를 검증합니다.
 *
 * @param {unknown} raw - 계약서 template.tierConfig 원본 JSON 값
 * @returns {PenaltyTier[]} 등급(tier) 정의 배열
 * @throws tiers 배열이 없거나 형식이 올바르지 않으면 에러
 */
export function parseTierConfig(raw: unknown): PenaltyTier[] {
  const config = raw as { tiers?: unknown };
  if (!config?.tiers || !Array.isArray(config.tiers)) {
    throw new Error('tierConfig 형식이 올바르지 않습니다.');
  }
  return config.tiers as PenaltyTier[];
}

/**
 * 집중 시간 대비 이탈 비율(%)을 계산해 해당하는 벌칙 등급·개수를 산정합니다.
 *
 * @param {number} totalEscapeMs - 누적 이탈 시간(밀리초)
 * @param {number} focusMin - 1라운드 집중 시간(분)
 * @param {number} rounds - 총 라운드 수
 * @param {PenaltyTier[]} tiers - 등급 구간 정의 배열
 * @returns {TierResult} 산정된 등급·벌칙 개수·전체 강제공개 여부
 */
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
 * 중도 포기자(탈주)에게 최고 등급(maxPct === null) 티어를 강제 부여합니다.
 * 룰렛을 생략하고 벌칙을 전체 강제 공개(isForceAll=true)합니다.
 *
 * @param {PenaltyTier[]} tiers - 등급 구간 정의 배열
 * @returns {TierResult} 최고 등급 기반 산정 결과(isForceAll=true)
 * @throws 최고 등급(maxPct=null) 티어가 없으면 에러
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

/**
 * 이탈 구간 중 '집중 시간'과 실제로 겹치는 시간만 합산합니다.
 * 휴식(break) 구간에 발생한 이탈은 벌칙 산정에서 제외하기 위함입니다.
 *
 * @param {number} escapedAtMs - 이탈 시작 시각(밀리초)
 * @param {number} returnedAtMs - 복귀 시각(밀리초)
 * @param {number} sessionStartMs - 세션 시작 시각(밀리초)
 * @param {number} focusMin - 1라운드 집중 시간(분)
 * @param {number} breakMin - 라운드 간 휴식 시간(분)
 * @param {number} rounds - 총 라운드 수
 * @returns {number} 집중 시간과 겹치는 이탈 시간 합(밀리초)
 */
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

/**
 * 서로 겹치는 시간 구간들을 하나로 병합합니다.
 * 여러 이탈 로그가 시간상 겹칠 때 중복 합산을 막기 위해 사용합니다.
 *
 * @param {{ start: number; end: number }[]} intervals - 병합할 시간 구간 배열
 * @returns {{ start: number; end: number }[]} 겹침이 제거된 구간 배열(시작 시각 오름차순)
 */
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
