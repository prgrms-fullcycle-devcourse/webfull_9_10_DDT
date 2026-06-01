'use client';

import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useYjsContract } from '@/hooks/useYjsContract';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { MobileLayout } from '../layout/mobileLayout';
import { BackButton } from '../layout/BackButton';
import { HeaderTitle } from '../layout/HeaderTitle';
import EditPermissionToggle from './EditPermissionToggle';
import { useRoom } from '@/contexts/RoomContext';
import { useAuthStore } from '@/store/useAuthStore';
import { useRoomStore } from '@/store/useRoomStore';
import MemberSignList from './MemberSignList';
import RoomTitle from './RoomTitle';
import TimerSettings from './TimerSettings';
import TierSettings from './TierSettings';
import PenaltyList from './PenaltyList';
import { Separator } from '../ui/separator';

interface ContractFormValues {
  focusMin: number;
  breakMin: number;
  rounds: number;
}

const ContractForm = () => {
  const room = useRoom();
  const me = useAuthStore((state) => state.me);
  const members = useRoomStore((state) => state.members);
  const hostId = useRoomStore((s) => s.hostId);

  const isHost = me?.id === hostId;

  const {
    fields,
    tiers,
    penalties,
    isConnected,
    fieldOwners,
    updateField,
    handleFocus,
    handleBlur,
    addTier,
    updateTier,
    removeTier,
    addPenalty,
    updatePenalty,
    removePenalty,
  } = useYjsContract(room.code, !!me, isHost);

  const [arrayError, setArrayError] = useState<string | null>(null);
  const methods = useForm<ContractFormValues>({
    values: fields,
    defaultValues: { focusMin: 0, breakMin: 0, rounds: 0 },
  });

  const validateArrays = (): string | null => {
    if (tiers.length === 0) return '벌칙 강도를 1단계 이상 설정해주세요';
    if (penalties.length === 0) return '벌칙을 1개 이상 입력해주세요';
    return null;
  };

  const onSubmit = (data: ContractFormValues) => {
    const error = validateArrays();
    if (error) {
      setArrayError(error);
      return;
    }
    setArrayError(null);
    console.log('서명 완료:', data, tiers, penalties);
  };

  if (!me) {
    return null;
  }

  const myMember = members[me.id];
  const canEdit = myMember?.canEdit ?? false;
  const memberList = Object.entries(members);
  const signedCount = memberList.filter(([, m]) => m.isSigned).length;
  const memberCount = memberList.length;
  const allSigned = signedCount === memberCount;

  return (
    <MobileLayout
      header={
        <>
          <BackButton />
          <HeaderTitle>계약서</HeaderTitle>
          <div className='absolute right-4 flex gap-1'>
            <Button
              size='sm'
              onClick={() => {}}
              className='text-xs px-4 py-0.5 rounded-sm bg-card border border-white/20'
            >
              저장
            </Button>
            <Button
              size='sm'
              onClick={() => {}}
              className='text-xs px-4 py-0.5 rounded-sm bg-card border border-white/20'
              disabled={!canEdit}
            >
              불러오기
            </Button>
          </div>
        </>
      }
    >
      <div className='flex flex-col gap-5'>
        <div className='flex flex-col gap-5 bg-(--surface) rounded-xl'>
          <RoomTitle
            isConnected={isConnected}
            title={room.title}
            code={room.code}
          />
          {isHost && <EditPermissionToggle />}
          <FormProvider {...methods}>
            <form
              onSubmit={methods.handleSubmit(onSubmit)}
              className='flex flex-col gap-5'
            >
              <TimerSettings
                yjs={{
                  fields,
                  fieldOwners,
                  updateField,
                  handleFocus,
                  handleBlur,
                }}
              />
              <PenaltyList
                yjs={{
                  addPenalty,
                  penalties,
                  updatePenalty,
                  removePenalty,
                  fieldOwners,
                  handleFocus,
                  handleBlur,
                }}
              />
              <TierSettings
                yjs={{
                  tiers,
                  addTier,
                  updateTier,
                  removeTier,
                  fieldOwners,
                  handleFocus,
                  handleBlur,
                }}
              />
              {arrayError && (
                <Alert variant='destructive'>
                  <AlertCircle className='h-4 w-4' />
                  <AlertTitle>오류</AlertTitle>
                  <AlertDescription>{arrayError}</AlertDescription>
                </Alert>
              )}
            </form>
          </FormProvider>
        </div>
        <div className='flex flex-col gap-5 bg-(--surface) rounded-xl mb-10'>
          <div className='flex flex-col mt-10 mb-5 items-center'>
            <p className='text-xl text-success'>모든 멤버가 서명해야</p>
            <p className='text-xl text-success'>타이머를 시작할 수 있어요!</p>
          </div>
          <MemberSignList />
        </div>
        <Separator />
        <div className='flex w-full gap-2'>
          <Button
            type='button'
            className='flex-1 py-5! rounded-sm! bg-card! border border-white/10'
          >
            나가기
          </Button>
          {isHost && !allSigned && (
            <Button
              type='button'
              disabled={!myMember.isSigned}
              className='flex-1 py-5! rounded-sm! bg-destructive'
            >
              강제 시작
            </Button>
          )}
          {isHost && allSigned && (
            <Button type='button' className='flex-1 py-5! rounded-sm!'>
              집중 시작
            </Button>
          )}
        </div>
      </div>
    </MobileLayout>
  );
};

export default ContractForm;
