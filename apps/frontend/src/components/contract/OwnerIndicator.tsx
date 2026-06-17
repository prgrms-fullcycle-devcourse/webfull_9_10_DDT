import { FieldOwner } from '@/types/contract';
import { Badge } from '../ui/badge';

export interface OwnerIndicatorProps {
  fieldKey: string;
  fieldOwners: Record<string, FieldOwner>;
}

/**
 * Yjs 협업 편집 시 특정 필드를 편집 중인 다른 멤버의 닉네임 뱃지를 표시합니다.
 * awareness 상태에서 해당 필드를 점유한 멤버가 없으면 렌더링하지 않습니다.
 * 멤버별 고유 색상으로 뱃지 테두리와 텍스트가 표시됩니다.
 *
 * @param fieldKey - Yjs 필드 키 (예: 'focusMin', 'penalty_abc123')
 * @param fieldOwners - 현재 편집 중인 필드별 소유자 맵
 */
export default function OwnerIndicator({
  fieldKey,
  fieldOwners,
}: OwnerIndicatorProps) {
  const owner = fieldOwners[fieldKey];
  if (!owner) return null;
  return (
    <Badge
      variant='outline'
      className='animate-pulse text-xs'
      style={{ borderColor: owner.color, color: owner.color }}
    >
      {owner.nickname}
    </Badge>
  );
}
