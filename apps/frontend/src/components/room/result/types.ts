/** 결과 화면에서 사용하는 개별 벌칙 항목 */
export type ResultPenaltyItem = {
  content: string;
  count: number;
};

/** 결과 화면에서 사용하는 멤버 정보 */
export type ResultMember = {
  memberId: string;
  userId: string | null;
  guestToken: string | null;
  nickname: string;
  profileImage: string | null;
  isHost: boolean;
  /** 이탈 시간 기준 순위 (1부터 시작) */
  rank: number;
  /** 총 이탈 시간 (밀리초) */
  totalEscapeMs: number;
  /** 적용된 벌칙 등급 (0 = 벌칙 없음) */
  penaltyTier: number;
  /** 이탈 없이 완주 여부 */
  isAllClear: boolean;
  /** 공개된 벌칙 수 */
  penaltyCount: number;
  /** 룰렛에서 아직 돌리지 않은 벌칙 수 */
  remainingSpins: number;
  /** 중도포기(탈옥) 시각. null이면 정상 종료 */
  gaveUpAt: string | null;
  penalties: {
    /** 전체 벌칙 수 (공개 + 미공개) */
    totalCount: number;
    /** 공개된 벌칙 목록 */
    items: ResultPenaltyItem[];
  };
};

/** 계약서(각서) 규칙 정보 */
export type ResultRule = {
  focusMin: number;
  breakMin: number;
  rounds: number;
  penalties: { itemId: string; content: string }[];
  tierConfig: {
    tiers?: {
      tier: number;
      minPct: number;
      maxPct: number | null;
      count: number;
    }[];
  };
};

/** GET /result/:roomCode 응답 전체 */
export type ResultResponse = {
  roomTitle: string;
  /** 총 세션 시간 (밀리초). null이면 미산정 */
  totalSessionMs: number | null;
  completedRounds: number | null;
  penaltyMemberCount: number;
  allClear: boolean;
  members: ResultMember[];
  rule: ResultRule | null;
  serverTime: string;
  rouletteEndsAt: string | null;
};
