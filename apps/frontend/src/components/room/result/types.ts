export type ResultPenaltyItem = {
  content: string;
  count: number;
};

export type ResultMember = {
  memberId: string;
  userId: string | null;
  guestToken: string | null;
  nickname: string;
  profileImage: string | null;
  isHost: boolean;
  rank: number;
  totalEscapeMs: number;
  penaltyTier: number;
  isAllClear: boolean;
  penaltyCount: number;
  remainingSpins: number;
  gaveUpAt: string | null;
  penalties: {
    totalCount: number;
    items: ResultPenaltyItem[];
  };
};

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

export type ResultResponse = {
  roomTitle: string;
  totalSessionMs: number | null;
  completedRounds: number | null;
  penaltyMemberCount: number;
  allClear: boolean;
  members: ResultMember[];
  rule: ResultRule | null;
  serverTime: string;
  rouletteEndsAt: string | null;
};
