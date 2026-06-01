import { FieldOwner } from '@/types/contract';
import { Badge } from '../ui/badge';
import { User } from 'lucide-react';

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
      className='ml-2 animate-pulse'
      style={{ borderColor: owner.color, color: owner.color }}
    >
      <User className='w-3 h-3 mr-1' />
      {owner.nickname} 편집 중
    </Badge>
  );
}
