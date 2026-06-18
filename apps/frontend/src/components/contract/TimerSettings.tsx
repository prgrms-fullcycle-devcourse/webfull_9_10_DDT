'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { UseContractYjsReturn } from '@/types/yjs';
import { useRoomStore } from '@/store/useRoomStore';
import { cn } from '@/lib/utils';
import { CONTRACT_INPUT_FOCUS } from './inputStyles';
import OwnerIndicator from './OwnerIndicator';
import { Separator } from '../ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { blockNonInteger, blurOnEnter } from './utils';

interface TimerSettingsProps {
  yjs: Pick<
    UseContractYjsReturn,
    'fields' | 'fieldOwners' | 'updateField' | 'handleFocus' | 'handleBlur'
  >;
}

/**
 * 분 단위 시간을 "X시간 Y분" 형식으로 변환합니다.
 *
 * @param minutes - 총 분
 * @returns 포맷된 시간 문자열
 */
function formatTime(minutes: number): string {
  if (minutes === 0) return '0분';
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}시간` : `${hours}시간 ${mins}분`;
}

interface TimerNumberInputProps {
  id: string;
  value: number;
  min: number;
  max?: number;
  disabled: boolean;
  isOwned: boolean;
  ownerColor?: string;
  className: string;
  onFocus: () => void;
  onBlur: () => void;
  onCommit: (value: number) => void;
}

/**
 * 타이머 설정용 숫자 입력 컴포넌트.
 * focus 시 값을 비워 새로 입력할 수 있게 하고, 입력 즉시 min/max로 clamp합니다.
 * blur 시 빈 값이면 이전 값으로 복원합니다.
 * 편집 중이 아닐 때만 외부 Yjs 값(다른 유저의 수정)을 로컬 draft에 반영합니다.
 *
 * @param id - input HTML id (label 연결용)
 * @param value - Yjs에서 받은 현재 값
 * @param min - 입력 최솟값
 * @param max - 입력 최댓값 (동적 계산됨)
 * @param disabled - 편집 불가 여부 (권한 없거나 다른 유저가 편집 중)
 * @param isOwned - 다른 유저가 이 필드를 편집 중인지 여부 (아웃라인 표시용)
 * @param ownerColor - 편집 중인 유저의 고유 색상
 * @param onFocus - Yjs awareness 포커스 등록 콜백
 * @param onBlur - Yjs awareness 포커스 해제 콜백
 * @param onCommit - 유효한 값 확정 시 Yjs에 동기화하는 콜백
 */
function TimerNumberInput({
  id,
  value,
  min,
  max,
  disabled,
  isOwned,
  ownerColor,
  className,
  onFocus,
  onBlur,
  onCommit,
}: TimerNumberInputProps) {
  const [draft, setDraft] = useState(String(value));
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (!isEditingRef.current) {
      setDraft(String(value));
    }
  }, [value]);

  return (
    <Input
      id={id}
      type='number'
      inputMode='numeric'
      min={min}
      max={max}
      step={1}
      value={draft}
      autoComplete='off'
      className={cn(
        CONTRACT_INPUT_FOCUS,
        isOwned && 'outline-2 outline-offset-1',
        className,
      )}
      style={{ outlineColor: ownerColor }}
      disabled={disabled}
      onFocus={() => {
        isEditingRef.current = true;
        setDraft('');
        onFocus();
      }}
      onKeyDown={(e) => {
        blockNonInteger(e);
        blurOnEnter(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          setDraft('');
          return;
        }
        const n = Math.floor(Number(raw));
        if (!Number.isFinite(n)) return;

        const clamped = Math.max(min, max !== undefined ? Math.min(max, n) : n);
        setDraft(String(clamped));
        onCommit(clamped);
      }}
      onBlur={() => {
        isEditingRef.current = false;
        const n = draft === '' ? value : Math.floor(Number(draft));
        let final = Number.isFinite(n) ? n : min;
        final = Math.max(min, final);
        if (max !== undefined) final = Math.min(max, final);
        setDraft(String(final));
        onCommit(final);
        onBlur();
      }}
    />
  );
}

/**
 * 타이머 시간 설정 카드 컴포넌트.
 * 집중 시간, 휴식 시간, 반복 횟수를 설정합니다.
 * 총 세션 시간이 10시간(600분)을 넘지 않도록 각 필드의 최댓값을 동적으로 계산합니다.
 * rounds가 1이면 휴식이 없으므로 breakMin 입력을 비활성화합니다.
 *
 * @param yjs - useYjsContract에서 반환된 타이머 설정 관련 함수/상태
 */
export default function TimerSettings({ yjs }: TimerSettingsProps) {
  const me = useAuth().me;
  const myMember = useRoomStore((state) =>
    me ? state.members[me.id] : undefined,
  );

  if (!me) return null;
  const { fields, fieldOwners, updateField, handleFocus, handleBlur } = yjs;

  const canEdit = myMember?.canEdit ?? false;
  const myNickname = myMember?.nickname ?? me.nickname;

  const { focusMin, breakMin, rounds } = fields;
  const totalMin = focusMin * rounds + breakMin * Math.max(0, rounds - 1);

  /** 총 세션 시간 상한 (10시간 = 600분). 백엔드 MAX_TOTAL_MIN과 동일 */
  const MAX_TOTAL_MIN = 600;

  // 각 필드의 동적 최대값: 다른 두 필드의 현재 값을 기반으로
  // 총 세션 시간이 600분을 넘지 않는 범위 내에서 계산
  const maxFocusMin = Math.max(
    1,
    Math.floor((MAX_TOTAL_MIN - breakMin * Math.max(0, rounds - 1)) / rounds),
  );
  const maxBreakMin =
    rounds > 1
      ? Math.max(
          1,
          Math.floor((MAX_TOTAL_MIN - focusMin * rounds) / (rounds - 1)),
        )
      : 59; // rounds=1이면 휴식 없음, 느슨하게
  const maxRounds = Math.max(
    1,
    Math.floor(MAX_TOTAL_MIN / (focusMin + breakMin)),
  );

  return (
    <Card>
      <CardHeader className='flex justify-between items-end'>
        <CardTitle>시간 설정</CardTitle>
        <CardDescription className='text-xs'>최대 10시간</CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className='grid grid-cols-2 gap-2'>
        <div className='space-y-2'>
          <div className='flex flex-col gap-1'>
            <Label htmlFor='focusMin' className='text-xs'>
              집중 시간
              <span className='text-muted-foreground'>(최대 120분)</span>
            </Label>
            <OwnerIndicator fieldKey='focusMin' fieldOwners={fieldOwners} />
          </div>
          <div className='flex w-full h-fit p-0 items-center gap-2'>
            <TimerNumberInput
              id='focusMin'
              value={focusMin}
              min={1}
              max={maxFocusMin < 120 ? maxFocusMin : 120}
              className='bg-background! h-12 w-26 border-white/20'
              isOwned={!!fieldOwners['focusMin']}
              ownerColor={fieldOwners['focusMin']?.color}
              disabled={
                !canEdit ||
                (!!fieldOwners['focusMin'] &&
                  fieldOwners['focusMin'].userId !== me.id)
              }
              onFocus={() => handleFocus('focusMin', me.id, myNickname)}
              onBlur={handleBlur}
              onCommit={(val) => updateField('focusMin', val)}
            />
            <span>분</span>
          </div>
        </div>

        <div className='space-y-2'>
          <div className='flex flex-col gap-1'>
            <Label htmlFor='breakMin' className='text-xs'>
              휴식 시간
              <span className='text-muted-foreground'>(최대 120분)</span>
            </Label>
            <OwnerIndicator fieldKey='breakMin' fieldOwners={fieldOwners} />
          </div>
          <div className='flex w-full h-fit p-0 items-center gap-2'>
            <TimerNumberInput
              id='breakMin'
              value={breakMin}
              min={1}
              max={maxBreakMin < 120 ? maxBreakMin : 120}
              className='bg-background! h-12 w-26 border-white/20'
              isOwned={!!fieldOwners['breakMin']}
              ownerColor={fieldOwners['breakMin']?.color}
              disabled={
                !canEdit ||
                (!!fieldOwners['breakMin'] &&
                  fieldOwners['breakMin'].userId !== me.id) ||
                rounds <= 1
              }
              onFocus={() => handleFocus('breakMin', me.id, myNickname)}
              onBlur={handleBlur}
              onCommit={(val) => updateField('breakMin', val)}
            />
            <span>분</span>
          </div>
        </div>

        <div className='space-y-2'>
          <div className='flex flex-col gap-1'>
            <Label htmlFor='rounds' className='text-xs'>
              반복 횟수
              <span className='text-muted-foreground'>(최대 20회)</span>
            </Label>
            <OwnerIndicator fieldKey='rounds' fieldOwners={fieldOwners} />
          </div>
          <div className='flex w-full h-fit p-0 items-center gap-2'>
            <TimerNumberInput
              id='rounds'
              value={rounds}
              min={1}
              max={maxRounds < 20 ? maxRounds : 20}
              className='bg-background! h-12 w-26 border border-white/20'
              isOwned={!!fieldOwners['rounds']}
              ownerColor={fieldOwners['rounds']?.color}
              disabled={
                !canEdit ||
                (!!fieldOwners['rounds'] &&
                  fieldOwners['rounds'].userId !== me.id)
              }
              onFocus={() => handleFocus('rounds', me.id, myNickname)}
              onBlur={handleBlur}
              onCommit={(val) => updateField('rounds', val)}
            />
            <span>회</span>
          </div>
        </div>
        <div className='space-y-2'>
          <div className='flex items-center'>
            <Label htmlFor='rounds' className='text-xs'>
              진행 예정 시간
            </Label>
          </div>
          <p className='w-full h-12 text-2xl p-1 items-start justify-center text-primary font-extrabold'>
            {formatTime(totalMin)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
