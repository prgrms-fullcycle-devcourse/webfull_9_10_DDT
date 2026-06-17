/** 특정 필드를 편집 중인 사용자 정보 (편집 중 표시·색상 구분용). */
export interface FieldOwner {
  userId: string;
  nickname: string;
  color: string;
}

/** 계약서 폼(react-hook-form)의 타이머 입력값. */
export interface ContractFormValues {
  focusMin: number;
  breakMin: number;
  rounds: number;
}
