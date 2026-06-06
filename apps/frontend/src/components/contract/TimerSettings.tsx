'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { UseContractYjsReturn } from '@/types/yjs';
import { useRoomStore } from '@/store/useRoomStore';
import { cn } from '@/lib/utils';
import OwnerIndicator from './OwnerIndicator';
import { Separator } from '../ui/separator';
import { useAuth } from '@/hooks/useAuth';

interface TimerSettingsProps {
  yjs: Pick<
    UseContractYjsReturn,
    'fields' | 'fieldOwners' | 'updateField' | 'handleFocus' | 'handleBlur'
  >;
}

function formatTime(minutes: number): string {
  if (minutes === 0) return '0분';
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}시간` : `${hours}시간 ${mins}분`;
}

// 자연수만 허용: 소수점(.), 부호(+/-), 지수(e/E) 키 입력을 차단한다.
function blockNonInteger(e: React.KeyboardEvent<HTMLInputElement>): void {
  if (['e', 'E', '+', '-', '.'].includes(e.key)) {
    e.preventDefault();
  }
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

// 입력 중에는 로컬 문자열로 자유롭게 편집(기존 값 지우기 가능)하고,
// 포커스가 없을 때만 외부(yjs) 값을 반영한다. blur 시 min/max로 보정.
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
      min={min}
      max={max}
      step={1}
      value={draft}
      className={cn(isOwned && 'outline-2 outline-offset-1', className)}
      style={{ outlineColor: ownerColor }}
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
          if (
            Number.isFinite(n) &&
            n >= min &&
            (max === undefined || n <= max)
          ) {
            onCommit(n);
          }
        }
      }}
      onBlur={() => {
        isEditingRef.current = false;
        const n = Math.floor(Number(draft));
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

export default function TimerSettings({ yjs }: TimerSettingsProps) {
  const me = useAuth().me;
  const members = useRoomStore((state) => state.members);

  if (!me) return null;
  const { fields, fieldOwners, updateField, handleFocus, handleBlur } = yjs;

  const myMember = members[me!.id];
  const canEdit = myMember?.canEdit ?? false;
  const myNickname = myMember?.nickname ?? me.nickname;

  const { focusMin, breakMin, rounds } = fields;
  const totalMin = focusMin * rounds + breakMin * Math.max(0, rounds - 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>타이머 설정</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className='grid grid-cols-2 gap-2'>
        <div className='space-y-2'>
          <div className='flex flex-col gap-1'>
            <Label htmlFor='focusMin' className='text-xs'>
              집중 시간
            </Label>
            <OwnerIndicator fieldKey='focusMin' fieldOwners={fieldOwners} />
          </div>
          <div className='flex w-full h-fit p-0 items-center gap-2'>
            <TimerNumberInput
              id='focusMin'
              value={focusMin}
              min={1}
              max={120}
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
            </Label>
            <OwnerIndicator fieldKey='breakMin' fieldOwners={fieldOwners} />
          </div>
          <div className='flex w-full h-fit p-0 items-center gap-2'>
            <TimerNumberInput
              id='breakMin'
              value={breakMin}
              min={1}
              className='bg-background! h-12 w-26 border-white/20'
              isOwned={!!fieldOwners['breakMin']}
              ownerColor={fieldOwners['breakMin']?.color}
              disabled={
                !canEdit ||
                (!!fieldOwners['breakMin'] &&
                  fieldOwners['breakMin'].userId !== me.id)
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
            </Label>
            <OwnerIndicator fieldKey='rounds' fieldOwners={fieldOwners} />
          </div>
          <div className='flex w-full h-fit p-0 items-center gap-2'>
            <TimerNumberInput
              id='rounds'
              value={rounds}
              min={1}
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
              총 예상 시간
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
