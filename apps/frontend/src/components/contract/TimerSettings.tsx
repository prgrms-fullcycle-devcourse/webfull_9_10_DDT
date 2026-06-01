'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ContractFormValues } from '@/types/contract';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { UseContractYjsReturn } from '@/types/yjs';
import { useFormContext } from 'react-hook-form';
import { useAuthStore } from '@/store/useAuthStore';
import { useRoomStore } from '@/store/useRoomStore';
import { cn } from '@/lib/utils';
import OwnerIndicator from './OwnerIndicator';
import { Separator } from '../ui/separator';

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

export default function TimerSettings({ yjs }: TimerSettingsProps) {
  const me = useAuthStore((state) => state.me);
  const members = useRoomStore((state) => state.members);
  const { register, setValue } = useFormContext<ContractFormValues>();

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
          <div className='flex items-center'>
            <Label htmlFor='focusMin' className='text-xs'>
              집중 시간
            </Label>
            <OwnerIndicator fieldKey='focusMin' fieldOwners={fieldOwners} />
          </div>
          <div className='flex w-full h-fit p-0 items-center gap-2'>
            <Input
              id='focusMin'
              type='number'
              {...register('focusMin', {
                required: true,
                min: 1,
                max: 120,
              })}
              className={cn(
                fieldOwners['focusMin'] && 'outline-2 outline-offset-1',
                'bg-background! h-12 w-26 border-white/20',
              )}
              style={{ outlineColor: fieldOwners['focusMin']?.color }}
              disabled={
                !canEdit ||
                (!!fieldOwners['focusMin'] &&
                  fieldOwners['focusMin'].userId !== me.id)
              }
              onFocus={() => handleFocus('focusMin', me.id, myNickname)}
              onBlur={handleBlur}
              onChange={(e) => {
                const val = Number(e.target.value);
                setValue('focusMin', val);
                updateField('focusMin', val);
              }}
            />
            <span>분</span>
          </div>
        </div>

        <div className='space-y-2'>
          <div className='flex items-center'>
            <Label htmlFor='breakMin' className='text-xs'>
              휴식 시간
            </Label>
            <OwnerIndicator fieldKey='breakMin' fieldOwners={fieldOwners} />
          </div>
          <div className='flex w-full h-fit p-0 items-center gap-2'>
            <Input
              id='breakMin'
              type='number'
              {...register('breakMin', { required: true, min: 1 })}
              className={cn(
                fieldOwners['breakMin'] && 'outline outline-2 outline-offset-1',
                'bg-background! h-12 w-26 border-white/20',
              )}
              style={{ outlineColor: fieldOwners['breakMin']?.color }}
              disabled={
                !canEdit ||
                (!!fieldOwners['breakMin'] &&
                  fieldOwners['breakMin'].userId !== me.id)
              }
              onFocus={() => handleFocus('breakMin', me.id, myNickname)}
              onBlur={handleBlur}
              onChange={(e) => {
                const val = Number(e.target.value);
                setValue('breakMin', val);
                updateField('breakMin', val);
              }}
            />
            <span>분</span>
          </div>
        </div>

        <div className='space-y-2'>
          <div className='flex items-center'>
            <Label htmlFor='rounds' className='text-xs'>
              반복 횟수
            </Label>
            <OwnerIndicator fieldKey='rounds' fieldOwners={fieldOwners} />
          </div>
          <div className='flex w-full h-fit p-0 items-center gap-2'>
            <Input
              id='rounds'
              type='number'
              {...register('rounds', { required: true, min: 1 })}
              className={cn(
                fieldOwners['rounds'] && 'outline outline-2 outline-offset-1',
                'bg-background! h-12 w-26 border border-white/20',
              )}
              style={{ outlineColor: fieldOwners['rounds']?.color }}
              disabled={
                !canEdit ||
                (!!fieldOwners['rounds'] &&
                  fieldOwners['rounds'].userId !== me.id)
              }
              onFocus={() => handleFocus('rounds', me.id, myNickname)}
              onBlur={handleBlur}
              onChange={(e) => {
                const val = Number(e.target.value);
                setValue('rounds', val);
                updateField('rounds', val);
              }}
            />
            <span>분</span>
          </div>
        </div>
        <div className='space-y-2'>
          <div className='flex items-center'>
            <Label htmlFor='rounds' className='text-xs'>
              총 예상 시간
            </Label>
            <OwnerIndicator fieldKey='rounds' fieldOwners={fieldOwners} />
          </div>
          <p className='w-full h-12 text-2xl p-1 items-start justify-center text-primary font-extrabold'>
            {formatTime(totalMin)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
