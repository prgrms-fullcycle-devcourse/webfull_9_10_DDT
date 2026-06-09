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
