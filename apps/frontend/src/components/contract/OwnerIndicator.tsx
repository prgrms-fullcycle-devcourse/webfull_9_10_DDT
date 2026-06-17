import { FieldOwner } from '@/types/contract';
import { Badge } from '../ui/badge';

export interface OwnerIndicatorProps {
  fieldKey: string;
  fieldOwners: Record<string, FieldOwner>;
}

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
