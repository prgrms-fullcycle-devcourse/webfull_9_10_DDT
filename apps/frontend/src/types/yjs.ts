/** 벌칙 강도 단계. 이탈 비율 구간(minPct~maxPct)에 따라 벌칙 count개를 부여한다. */
export interface Tier {
  /** 단계 번호 (1부터) */
  tier: number;
  /** 구간 시작 비율(%) */
  minPct: number;
  /** 구간 끝 비율(%). null이면 100%(마지막 단계, 상한 없음) */
  maxPct: number | null;
  /** 이 단계에서 부여할 벌칙 개수 */
  count: number;
}

/** 벌칙 항목 하나. */
export interface Penalty {
  id: string;
  content: string;
}

/** 계약서 타이머 설정 (분 단위 집중·휴식 시간, 반복 횟수). */
export interface ContractFields {
  focusMin: number;
  breakMin: number;
  rounds: number;
}

/** 현재 누군가 편집(포커스) 중인 필드 정보. awareness로 공유되어 편집 중 표시·잠금에 쓴다. */
export interface FocusedField {
  /** 점유 중인 필드 식별자 */
  fieldKey: string;
  userId: string;
  nickname: string;
  /** 편집자 표시용 색상 */
  color: string;
}

/** Yjs awareness로 참가자별 공유되는 상태. focusedField 외 임의 키도 허용한다. */
export interface AwarenessState {
  focusedField?: FocusedField | null;
  [key: string]: unknown;
}

/** useYjsContract 훅의 반환 타입. 동기화된 상태 + 갱신/포커스 핸들러 모음. */
export interface UseContractYjsReturn {
  fields: ContractFields;
  fieldOwners: Record<string, FocusedField>;
  tiers: Tier[];
  penalties: Penalty[];
  isConnected: boolean;
  updateField: (key: keyof ContractFields, value: number) => void;
  addTier: () => void;
  updateTier: (index: number, updated: Partial<Tier>) => void;
  setTierBoundary: (index: number, maxPct: number) => void;
  removeTier: (index: number) => void;
  addPenalty: (content: string) => void;
  updatePenalty: (index: number, content: string) => void;
  removePenalty: (index: number) => void;
  handleFocus: (fieldKey: string, userId: string, nickname: string) => void;
  handleBlur: () => void;
  applyAll: (data: ApplyData) => void;
}

/** 저장된 계약서를 불러올 때 어떤 항목을 적용할지 선택하는 옵션. */
export interface ApplyOptions {
  fields: boolean;
  tiers: boolean;
  penalties: boolean;
  /** 벌칙 적용 방식: 'replace'(기존 대체) | 'append'(뒤에 추가) */
  penaltyMode: 'replace' | 'append';
}

/** applyAll에 전달하는 실제 적용 데이터. 지정한 항목만 부분 적용된다. */
export interface ApplyData {
  fields?: ContractFields;
  tiers?: Tier[];
  penalties?: Penalty[];
  /** 벌칙 적용 방식 (기본 'replace') */
  penaltyMode?: 'replace' | 'append';
}
