import type { Tier, Penalty, ContractFields } from '@/types/yjs';

export interface SavedRule {
  ruleId: string;
  title: string;
  focusMin: number;
  breakMin: number;
  rounds: number;
  penalties: { itemId: string; content: string }[];
  tierConfig: { tiers: Tier[] };
}

export interface ContractDataForSave {
  focusMin: number;
  breakMin: number;
  rounds: number;
  penalties: string[];
  tierConfig: { tiers: Tier[] };
}

/**
 * 화면/Yjs에서 다루는 계약서 상태를 백엔드 저장 포맷으로 변환한다.
 * 벌칙은 빈 내용을 제외하고 content 문자열 배열로 평탄화한다.
 *
 * @param fields - 타이머 설정(focusMin·breakMin·rounds)
 * @param tiers - 벌칙 강도 단계 배열
 * @param penalties - 벌칙 항목 배열(id·content)
 * @returns 백엔드 저장용 객체
 */
export function toBackendFormat(
  fields: ContractFields,
  tiers: Tier[],
  penalties: Penalty[],
): ContractDataForSave {
  return {
    focusMin: fields.focusMin,
    breakMin: fields.breakMin,
    rounds: fields.rounds,
    penalties: penalties
      .filter((p) => p.content.trim() !== '')
      .map((p) => p.content),
    tierConfig: { tiers },
  };
}

/**
 * 저장된 계약서 템플릿(SavedRule)을 화면/Yjs에서 쓰는 포맷으로 변환한다.
 * 벌칙은 itemId를 Yjs 항목 id로 매핑한다. (불러오기 시 사용)
 *
 * @param rule - 서버에서 받은 저장 규칙
 * @returns fields·tiers·penalties로 구성된 Yjs 입력 포맷
 */
export function toYjsFormat(rule: SavedRule): {
  fields: ContractFields;
  tiers: Tier[];
  penalties: Penalty[];
} {
  return {
    fields: {
      focusMin: rule.focusMin,
      breakMin: rule.breakMin,
      rounds: rule.rounds,
    },
    tiers: rule.tierConfig.tiers,
    penalties: rule.penalties.map((p) => ({
      id: p.itemId,
      content: p.content,
    })),
  };
}
