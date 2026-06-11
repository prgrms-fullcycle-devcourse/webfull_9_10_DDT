import { useEffect, useRef, useState } from 'react';
import { Plus, User, X } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { useRoomStore } from '@/store/useRoomStore';
import { Tier, UseContractYjsReturn } from '@/types/yjs';
import { Separator } from '../ui/separator';
import { useAuth } from '@/hooks/useAuth';

interface TierSettingsProps {
  yjs: Pick<
    UseContractYjsReturn,
    | 'tiers'
    | 'addTier'
    | 'updateTier'
    | 'setTierBoundary'
    | 'removeTier'
    | 'fieldOwners'
    | 'handleFocus'
    | 'handleBlur'
  >;
}

// 단계가 아직 시드되지 않았을 때(비호스트가 동기화 전 진입 등) 모두에게 보여줄 기본 단계.
// yjs 문서에는 쓰지 않고 화면 표시용으로만 사용한다. (동시 시드로 인한 단계 중복 방지)
const DEFAULT_TIER: Tier = { tier: 1, minPct: 0, maxPct: null, count: 0 };

// 자연수만 허용: 소수점(.), 부호(+/-), 지수(e/E) 키 입력을 차단한다.
function blockNonInteger(e: React.KeyboardEvent<HTMLInputElement>): void {
  if (['e', 'E', '+', '-', '.'].includes(e.key)) {
    e.preventDefault();
  }
}

interface PenaltyCountInputProps {
  value: number;
  disabled: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onCommit: (value: number) => void;
}

// 입력 중에는 로컬 문자열로 자유롭게 편집(0 지우기 가능)하고,
// 포커스가 없을 때만 외부(yjs) 값을 반영한다. (숫자에 묶이면 "0"이 안 지워지는 문제 방지)
function PenaltyCountInput({
  value,
  disabled,
  onFocus,
  onBlur,
  onCommit,
}: PenaltyCountInputProps) {
  const [draft, setDraft] = useState(String(value));
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (!isEditingRef.current) {
      setDraft(String(value));
    }
  }, [value]);

  return (
    <Input
      className='bg-background! h-12 w-15 border-white/20'
      type='number'
      min={0}
      step={1}
      value={draft}
      disabled={disabled}
      onFocus={() => {
        isEditingRef.current = true;
        onFocus();
      }}
      onKeyDown={blockNonInteger}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw !== '') {
          const n = Math.floor(Number(raw));
          if (Number.isFinite(n) && n >= 0) {
            onCommit(n);
          }
        }
      }}
      onBlur={() => {
        isEditingRef.current = false;
        const n = Math.floor(Number(draft));
        const final = Number.isFinite(n) && n >= 0 ? n : 0;
        setDraft(String(final));
        onCommit(final);
        onBlur();
      }}
    />
  );
}

interface TierPctInputProps {
  value: number | null;
  minPct: number;
  disabled: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onCommit: (value: number) => void;
}

// 종료%(maxPct) 입력. 입력 중에는 로컬 문자열로 자유 편집하고,
// 포커스가 없을 때만 외부(yjs) 값을 반영한다. blur 시 minPct 초과 & 1~99로 보정.
function TierPctInput({
  value,
  minPct,
  disabled,
  onFocus,
  onBlur,
  onCommit,
}: TierPctInputProps) {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (!isEditingRef.current) {
      setDraft(value === null ? '' : String(value));
    }
  }, [value]);

  return (
    <Input
      className='bg-background! h-12 w-15 border-white/20'
      type='number'
      min={minPct + 1}
      max={99}
      step={1}
      value={draft}
      disabled={disabled}
      onFocus={() => {
        isEditingRef.current = true;
        onFocus();
      }}
      onKeyDown={blockNonInteger}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw !== '') {
          const n = Math.floor(Number(raw));
          if (Number.isFinite(n) && n > minPct && n <= 99) {
            onCommit(n);
          }
        }
      }}
      onBlur={() => {
        isEditingRef.current = false;
        const n = Math.floor(Number(draft));
        const valid = Number.isFinite(n) && n > minPct && n <= 99;
        const final = valid ? n : Math.min(99, minPct + 1);
        setDraft(String(final));
        onCommit(final);
        onBlur();
      }}
    />
  );
}

export default function TierSettings({ yjs }: TierSettingsProps) {
  const me = useAuth().me;
  const members = useRoomStore((state) => state.members);

  if (!me) return null;

  const {
    tiers,
    addTier,
    updateTier,
    setTierBoundary,
    removeTier,
    fieldOwners,
    handleFocus,
    handleBlur,
  } = yjs;
  const myMember = members[me.id];
  const canEdit = myMember?.canEdit ?? false;
  const myNickname = myMember?.nickname ?? me.nickname;

  // 단계가 비어있으면 모두에게 기본 0~100 단계를 보여준다(표시 전용).
  const isFallback = tiers.length === 0;
  const displayTiers = isFallback ? [DEFAULT_TIER] : tiers;

  const canAddTier = (() => {
    if (!canEdit) {
      return false;
    }
    if (tiers.length === 0) {
      return true;
    }

    // 마지막 단계는 100%까지이므로, 그 시작값이 99% 미만일 때만 더 쪼갤 수 있다.
    const last = tiers[tiers.length - 1];
    return last.minPct < 99;
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle>벌칙 강도</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent>
        <div className='space-y-2'>
          {displayTiers.map((tier, i) => {
            const tierKey = `tier_${i}`;
            const tierOwner = fieldOwners[tierKey];
            const isLockedByOther = !!tierOwner && tierOwner.userId !== me.id;
            const isLastTier = i === displayTiers.length - 1;

            return (
              <div key={`tier-${i}`} className='flex flex-col gap-1'>
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
                    {isLastTier ? (
                      <span className='flex h-12 w-15 items-center justify-center text-sm font-mono text-muted-foreground'>
                        100
                      </span>
                    ) : (
                      <TierPctInput
                        value={tier.maxPct}
                        minPct={tier.minPct}
                        disabled={!canEdit || isLockedByOther}
                        onFocus={() => handleFocus(tierKey, me.id, myNickname)}
                        onBlur={handleBlur}
                        onCommit={(val) => setTierBoundary(i, val)}
                      />
                    )}
                    <span>%</span>
                  </div>
                  <div className='flex-1 flex gap-1 ml-3 p-0 items-center'>
                    <span className='flex-1 text-sm w-8'>벌칙</span>
                    <PenaltyCountInput
                      value={tier.count}
                      disabled={!canEdit || isLockedByOther}
                      onFocus={() => handleFocus(tierKey, me.id, myNickname)}
                      onBlur={handleBlur}
                      onCommit={(val) => updateTier(i, { count: val })}
                    />
                    <span className='text-sm'>개</span>
                  </div>
                  {canEdit && tiers.length > 1 && i !== 0 ? (
                    <Button
                      variant='ghost'
                      size='icon'
                      aria-label={`${tier.tier}단계 벌칙 강도 삭제`}
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
            <>
              {!canAddTier && (
                <CardDescription className='text-xs'>
                  더 이상 추가할 수 없습니다. 입력값을 확인해주세요
                </CardDescription>
              )}
              <Button
                type='button'
                variant='ghost'
                size='lg'
                onClick={addTier}
                disabled={!canAddTier}
                className='w-full ring-1 ring-ring'
              >
                <Plus className='w-4 h-4 mr-1' /> 단계 추가
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
