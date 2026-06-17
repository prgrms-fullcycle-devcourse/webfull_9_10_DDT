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
import { CONTRACT_INPUT_FOCUS } from './inputStyles';
import { useRoomStore } from '@/store/useRoomStore';
import { Tier, UseContractYjsReturn } from '@/types/yjs';
import { Separator } from '../ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { blockNonInteger } from './utils';

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
// Yjs 문서에는 쓰지 않고 화면 표시용으로만 사용한다. (동시 시드로 인한 단계 중복 방지)
const DEFAULT_TIER: Tier = { tier: 1, minPct: 0, maxPct: null, count: 0 };

interface PenaltyCountInputProps {
  value: number;
  disabled: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onCommit: (value: number) => void;
}

/**
 * 벌칙 개수 입력 컴포넌트.
 * 입력 중에는 로컬 문자열로 자유 편집(0 지우기 가능)하고,
 * 포커스가 없을 때만 외부 Yjs 값을 반영합니다.
 * focus 시 값을 비워 새로 입력할 수 있게 하고, blur 시 유효하지 않으면 이전 값으로 복원합니다.
 *
 * @param value - Yjs에서 받은 현재 벌칙 개수
 * @param disabled - 편집 불가 여부 (권한 없거나 다른 유저가 편집 중)
 * @param onFocus - Yjs awareness 포커스 등록 콜백
 * @param onBlur - Yjs awareness 포커스 해제 콜백
 * @param onCommit - 유효한 값 확정 시 Yjs에 동기화하는 콜백
 */
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
      className={`bg-background! h-12 w-15 border-white/20 ${CONTRACT_INPUT_FOCUS}`}
      type='number'
      min={0}
      step={1}
      value={draft}
      disabled={disabled}
      onFocus={() => {
        isEditingRef.current = true;
        setDraft('');
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
        const final = draft === '' || !Number.isFinite(n) || n < 0 ? value : n;
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

/**
 * 벌칙 등급 종료 퍼센트(maxPct) 입력 컴포넌트.
 * minPct 초과 ~ 99 이하만 허용하며, blur 시 범위 밖이면 자동 보정합니다.
 * 마지막 등급은 100% 고정이므로 이 컴포넌트 대신 텍스트를 표시합니다.
 *
 * @param value - 현재 종료 퍼센트. null이면 최상위 등급 (100%)
 * @param minPct - 이 등급의 시작 퍼센트 (입력 하한)
 * @param disabled - 편집 불가 여부
 * @param onFocus - Yjs awareness 포커스 등록 콜백
 * @param onBlur - Yjs awareness 포커스 해제 콜백
 * @param onCommit - 유효한 값 확정 시 Yjs에 동기화하는 콜백
 */
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
      className={`bg-background! h-12 w-15 border-white/20 ${CONTRACT_INPUT_FOCUS}`}
      type='number'
      min={minPct + 1}
      max={99}
      step={1}
      value={draft}
      disabled={disabled}
      onFocus={() => {
        isEditingRef.current = true;
        setDraft('');
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
        const valid =
          draft !== '' && Number.isFinite(n) && n > minPct && n <= 99;
        const final = valid ? n : (value ?? Math.min(99, minPct + 1));
        setDraft(String(final));
        onCommit(final);
        onBlur();
      }}
    />
  );
}

/**
 * 벌칙 등급(단계) 설정 카드 컴포넌트.
 * 이탈 시간 비율 구간별 벌칙 개수를 설정합니다.
 * 등급 추가/삭제, 구간 경계(%) 조정, 벌칙 개수 입력을 지원합니다.
 * 마지막 등급의 시작%가 99% 이상이면 더 이상 추가할 수 없습니다.
 *
 * @param yjs - useYjsContract에서 반환된 등급 관련 함수/상태
 */
export default function TierSettings({ yjs }: TierSettingsProps) {
  const me = useAuth().me;
  const myMember = useRoomStore((state) =>
    me ? state.members[me.id] : undefined,
  );

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
  const canEdit = myMember?.canEdit ?? false;
  const myNickname = myMember?.nickname ?? me.nickname;

  // 단계가 비어있으면 모두에게 기본 0~100% 단계를 보여준다 (표시 전용, Yjs에 쓰지 않음)
  const isFallback = tiers.length === 0;
  const displayTiers = isFallback ? [DEFAULT_TIER] : tiers;

  // 단계 추가 가능 여부: 편집 권한 + 마지막 등급의 시작%가 99 미만이어야 분할 가능
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
        <CardTitle>벌칙 단계</CardTitle>
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
                      aria-label={`${tier.tier}단계 벌칙 단계 삭제`}
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
                  더 이상 추가할 수 없어요. 입력값을 확인해주세요.
                </CardDescription>
              )}
              <Button
                type='button'
                variant='outline'
                size='lg'
                onClick={addTier}
                disabled={!canAddTier}
                className='w-full'
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
