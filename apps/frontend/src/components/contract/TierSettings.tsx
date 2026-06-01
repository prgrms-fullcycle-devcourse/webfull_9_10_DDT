import { Plus, User, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { useAuthStore } from '@/store/useAuthStore';
import { useRoomStore } from '@/store/useRoomStore';
import { UseContractYjsReturn } from '@/types/yjs';
import { Separator } from '../ui/separator';

interface TierSettingsProps {
  yjs: Pick<
    UseContractYjsReturn,
    | 'tiers'
    | 'addTier'
    | 'updateTier'
    | 'removeTier'
    | 'fieldOwners'
    | 'handleFocus'
    | 'handleBlur'
  >;
}

export default function TierSettings({ yjs }: TierSettingsProps) {
  const me = useAuthStore((state) => state.me);
  const members = useRoomStore((state) => state.members);

  if (!me) return null;

  const {
    tiers,
    addTier,
    updateTier,
    removeTier,
    fieldOwners,
    handleFocus,
    handleBlur,
  } = yjs;
  const myMember = members[me.id];
  const canEdit = myMember?.canEdit ?? false;
  const myNickname = myMember?.nickname ?? me.nickname;

  return (
    <Card>
      <CardHeader>
        <CardTitle>벌칙 강도</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent>
        <div className='space-y-2'>
          {tiers.map((tier, i) => {
            const tierKey = `tier_${i}`;
            const tierOwner = fieldOwners[tierKey];
            const isLockedByOther = !!tierOwner && tierOwner.userId !== me.id;

            return (
              <div key={tier.tier} className='flex flex-col gap-1'>
                <div className='w-full rounded-sm h-7 bg-primary relative flex justify-center items-center p-0'>
                  <p>{tier.tier}단계</p>
                </div>
                {isLockedByOther && (
                  <Badge
                    variant='outline'
                    className='animate-pulse text-xs'
                    style={{
                      borderColor: tierOwner.color,
                      color: tierOwner.color,
                    }}
                  >
                    <User className='w-3 h-3 mr-1' />
                    {tierOwner.nickname}
                  </Badge>
                )}

                <div className='flex items-center gap-1 bg-muted/30 p-2 justify-between rounded-md'>
                  <span className='flex-1 text-sm font-mono'>
                    {tier.minPct}% ~
                  </span>
                  <div className='flex-1 flex gap-2 p-0 items-center'>
                    <Input
                      className='bg-background! h-12 w-15 border-white/20'
                      type='number'
                      value={tier.maxPct ?? ''}
                      disabled={
                        !canEdit ||
                        (tiers.length > 1 && i === tiers.length - 1) ||
                        isLockedByOther
                      }
                      onFocus={() => handleFocus(tierKey, me.id, myNickname)}
                      onBlur={handleBlur}
                      onChange={(e) => {
                        const newMaxPct = Number(e.target.value);
                        updateTier(i, { maxPct: newMaxPct });
                        if (i + 1 < tiers.length) {
                          updateTier(i + 1, { minPct: newMaxPct });
                        }
                      }}
                    />
                    <span>%</span>
                  </div>
                  <div className='flex-1 flex gap-1 ml-3 p-0 items-center'>
                    <span className='flex-1 text-sm w-8'>벌칙</span>
                    <Input
                      className='bg-background! h-12 w-15 border-white/20'
                      type='number'
                      value={tier.count}
                      disabled={!canEdit || isLockedByOther}
                      onFocus={() => handleFocus(tierKey, me.id, myNickname)}
                      onBlur={handleBlur}
                      onChange={(e) =>
                        updateTier(i, { count: Number(e.target.value) })
                      }
                    />
                    <span className='text-sm'>개</span>
                  </div>
                  {canEdit && tiers.length > 1 && i !== 0 ? (
                    <Button
                      variant='ghost'
                      size='icon'
                      className='flex-1'
                      type='button'
                      onClick={() => removeTier(i)}
                    >
                      <X className='w-4 h-4' />
                    </Button>
                  ) : (
                    <div className='flex-1 w-4 h-4' />
                  )}
                </div>
              </div>
            );
          })}

          {canEdit && (
            <Button
              type='button'
              variant='ghost'
              size='lg'
              onClick={addTier}
              className='w-full ring-1 ring-ring'
            >
              <Plus className='w-4 h-4 mr-1' /> 단계 추가
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
