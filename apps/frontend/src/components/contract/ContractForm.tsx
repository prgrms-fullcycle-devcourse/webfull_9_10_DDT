'use client';

import { useRouter } from 'next/navigation';
import { FormProvider, useForm } from 'react-hook-form';
import { useYjsContract } from '@/hooks/useYjsContract';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getRoomApi } from '@/api/generated/room-api/room-api';

import { MobileLayout } from '../layout/mobileLayout';
import { BackButton } from '../layout/BackButton';
import { HeaderTitle } from '../layout/HeaderTitle';
import EditPermissionToggle from './EditPermissionToggle';
import { useRoom } from '@/contexts/RoomContext';
import { useRoomStore } from '@/store/useRoomStore';
import MemberSignList from './MemberSignList';
import RoomTitle from './RoomTitle';
import TimerSettings from './TimerSettings';
import TierSettings from './TierSettings';
import PenaltyList from './PenaltyList';
import { Separator } from '../ui/separator';
import { ContractActions } from './ContractActions';
import { useConfirm } from '@/hooks/useConfirm';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getTimerApi } from '@/api/generated/timer-api-타이머-및-세션-제어/timer-api-타이머-및-세션-제어';
import axios from 'axios';
import { ContractDataForSave, toBackendFormat } from '@/lib/contractTransform';
import { getRuleApi } from '@/api/generated/rule-api-계약서-관리/rule-api-계약서-관리';
import { useAuth } from '@/hooks/useAuth';
import NoSleep from 'nosleep.js';
import { clearGuestAccessToken } from '@/lib/authToken';
import { queryKeys } from '@/lib/queryKeys';

interface ContractFormValues {
  focusMin: number;
  breakMin: number;
  rounds: number;
}

const ContractForm = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const room = useRoom();
  const me = useAuth().me;
  const members = useRoomStore((state) => state.members);
  const hostId = useRoomStore((s) => s.hostId);
  const phase = useRoomStore((s) => s.phase);
  const noSleepRef = useRef<NoSleep | null>(null);
  if (noSleepRef.current === null) {
    noSleepRef.current = new NoSleep();
  }

  const isHost = me?.id === hostId;
  const yjsEnabled =
    !!me && (phase === null || phase === 'contract' || phase === 'lobby');

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
    setTierBoundary,
    removeTier,
    addPenalty,
    updatePenalty,
    removePenalty,
    applyAll,
  } = useYjsContract(room.code, yjsEnabled, isHost);

  const { confirm, confirmProps } = useConfirm();

  const methods = useForm<ContractFormValues>({
    values: fields,
    defaultValues: { focusMin: 1, breakMin: 1, rounds: 1 },
  });

  const createRoomRuleMutation = useMutation({
    mutationFn: async (dto: ContractDataForSave) => {
      const res = await getRuleApi().ruleControllerCreateRoomRule(
        room.code,
        dto,
      );
      return res.data;
    },
  });

  const startTimerMutation = useMutation({
    mutationFn: async () => {
      const res = await getTimerApi().timerControllerStartTimer(room.code);
      return res.data;
    },
    onError: (err) => {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      toast.error(message ?? '시작 실패');
    },
  });

  const forceStartTimerMutation = useMutation({
    mutationFn: async () => {
      const res = await getTimerApi().timerControllerForceStartTimer(room.code);
      return res.data;
    },
    onError: (err) => {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      toast.error(message ?? '강제 시작 실패');
    },
  });

  const handleStartFocus = async () => {
    try {
      const dto = toBackendFormat(fields, tiers, penalties);

      await createRoomRuleMutation.mutateAsync(dto);

      await startTimerMutation.mutateAsync();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      toast.error(message ?? '시작 실패');
    }
  };

  const handleForceStartFocus = async () => {
    try {
      noSleepRef.current?.enable();
    } catch {}
    try {
      const dto = toBackendFormat(fields, tiers, penalties);

      await createRoomRuleMutation.mutateAsync(dto);

      await forceStartTimerMutation.mutateAsync();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      toast.error(message ?? '시작 실패');
    }
  };

  useEffect(() => {
    if (phase === 'timer') {
      router.replace(`/room/${room.code}/timer`);
    } else if (phase === 'result') {
      router.replace(`/room/${room.code}/semi-result`);
    }
  }, [phase, room.code, router]);

  const handleLeaveRoom = async () => {
    const ok = await confirm({
      title: isHost
        ? `방장이 나가면 방이 폭파됩니다.\n정말 나가시겠어요?`
        : '정말 방에서 나가시겠어요?',
      confirmText: '나가기',
      variant: 'destructive',
    });
    if (!ok) {
      return;
    }

    try {
      await getRoomApi().roomControllerLeaveRoom(room.code);
      if (clearGuestAccessToken()) {
        queryClient.setQueryData(queryKeys.auth.me(), null);
      }
      router.replace('/');
    } catch {
      toast.error('퇴장 처리에 실패했습니다.');
    }
  };

  const handleForceStart = async () => {
    if (!isHost) {
      return;
    }
    const ok = await confirm({
      title: `강제로 시작하시겠습니까?`,
      description: '서명하지 않은 유저는 자동으로 강퇴됩니다.',
      confirmText: '시작하기',
      cancelText: '아니요',
      variant: 'destructive',
    });
    if (!ok) {
      return;
    }

    await handleForceStartFocus();
  };

  if (!me) {
    return null;
  }

  const myMember = members[me.id];
  const memberList = Object.entries(members);
  const signedCount = memberList.filter(([, m]) => m.isSigned).length;
  const memberCount = memberList.length;
  const allSigned = signedCount === memberCount;
  const isMeSigned = myMember?.isSigned ?? false;

  return (
    <MobileLayout
      header={
        <>
          <BackButton onClick={handleLeaveRoom} />
          <HeaderTitle>계약서</HeaderTitle>
          <div className='absolute right-4 flex gap-1'>
            <ContractActions
              fields={fields}
              tiers={tiers}
              penalties={penalties}
              applyAll={applyAll}
            />
          </div>
        </>
      }
    >
      <div className='flex flex-col gap-5'>
        <div className='flex flex-col gap-5  rounded-xl'>
          <RoomTitle
            isConnected={isConnected}
            title={room.title}
            code={room.code}
          />
          {isHost && <EditPermissionToggle />}
          <FormProvider {...methods}>
            <form className='flex flex-col gap-5'>
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
                  setTierBoundary,
                  removeTier,
                  fieldOwners,
                  handleFocus,
                  handleBlur,
                }}
              />
            </form>
          </FormProvider>
        </div>
        <div className='flex flex-col gap-5  rounded-xl mb-10'>
          <div className='flex flex-col mt-10 mb-5 items-center'>
            <p className='text-xl text-success'>모든 멤버가 서명해야</p>
            <p className='text-xl text-success'>타이머를 시작할 수 있어요!</p>
          </div>
          <MemberSignList />
        </div>

        <div className='flex w-full gap-2'>
          <Button
            type='button'
            variant='secondary'
            className='flex-1 h-12 rounded-[14px] text-base font-bold'
            onClick={handleLeaveRoom}
          >
            나가기
          </Button>
          {isHost && !allSigned && memberCount !== 1 && (
            <Button
              type='button'
              disabled={!isMeSigned}
              className='flex-1 h-12 rounded-[14px] text-base font-bold bg-destructive'
              onClick={handleForceStart}
            >
              강제 시작
            </Button>
          )}
          {isHost && (allSigned || memberCount === 1) && (
            <Button
              type='button'
              disabled={startTimerMutation.isPending || !isMeSigned}
              onClick={async () => {
                await handleStartFocus();
              }}
              className='flex-1 h-12 rounded-[14px] text-base font-bold'
            >
              {startTimerMutation.isPending ? '시작 중...' : '집중 시작'}
            </Button>
          )}
        </div>
      </div>
      <ConfirmDialog {...confirmProps} />
    </MobileLayout>
  );
};

export default ContractForm;
