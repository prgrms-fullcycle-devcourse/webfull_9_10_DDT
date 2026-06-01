export interface Tier {
  tier: number;
  minPct: number;
  maxPct: number | null;
  count: number;
}

export interface Penalty {
  id: string;
  content: string;
}

export interface ContractFields {
  focusMin: number;
  breakMin: number;
  rounds: number;
}

export interface FocusedField {
  fieldKey: string;
  userId: string;
  nickname: string;
  color: string;
}

export interface AwarenessState {
  focusedField?: FocusedField | null;
  [key: string]: unknown;
}

export interface UseContractYjsReturn {
  fields: ContractFields;
  fieldOwners: Record<string, FocusedField>;
  tiers: Tier[];
  penalties: Penalty[];
  isConnected: boolean;
  updateField: (key: keyof ContractFields, value: number) => void;
  addTier: () => void;
  updateTier: (index: number, updated: Partial<Tier>) => void;
  removeTier: (index: number) => void;
  addPenalty: (content: string) => void;
  updatePenalty: (index: number, content: string) => void;
  removePenalty: (index: number) => void;
  handleFocus: (fieldKey: string, userId: string, nickname: string) => void;
  handleBlur: () => void;
}
