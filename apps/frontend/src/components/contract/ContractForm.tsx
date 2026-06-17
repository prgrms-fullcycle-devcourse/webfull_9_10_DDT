'use client';

import { useRouter } from 'next/navigation';
import { FormProvider, useForm } from 'react-hook-form';
import { useYjsContract } from '@/hooks/useYjsContract';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getRoomApi } from '@/api/generated/room-api/room-api';
import { useShallow } from 'zustand/react/shallow';
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
import { cn } from '@/lib/utils';

interface ContractFormValues {
  focusMin: number;
  breakMin: number;
  rounds: number;
}

/**
 * 계약서(각서) 작성 페이지의 메인 컴포넌트.
 * Yjs를 통한 실시간 협업 편집, 타이머/벌칙/등급 설정, 멤버 서명, 세션 시작을 관리합니다.
 * 전원 서명 완료 시 "감금 시작", 미서명 멤버 존재 시 "강제 시작"(자동 강퇴) 버튼을 표시합니다.
 */
const ContractForm = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const room = useRoom();
  const me = useAuth().me;
  const { members, hostId } = useRoomStore(
    useShallow((s) => ({ members: s.members, hostId: s.hostId })),
  );
  const myMember = useRoomStore((state) =>
    me ? state.members[me.id] : undefined,
  );
  const phase = useRoomStore((s) => s.phase);
  const noSleepRef = useRef<NoSleep | null>(null);
  // NoSleep은 렌더 중 생성하지 않고 lazy getter로 필요 시 1회 생성 (React 원칙 준수)
  const getNoSleep = () => {
    if (!noSleepRef.current) noSleepRef.current = new NoSleep();
    return noSleepRef.current;
  };

  const isHost = me?.id === hostId;
  // contract/lobby 페이즈에서만 Yjs 동기화를 활성화한다.
  // timer 이후에는 계약서 편집이 불필요하므로 연결을 끊는다.
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

  // 언마운트 시 ContractForm에서 활성화한 NoSleep 정리
  useEffect(() => {
    return () => {
      noSleepRef.current?.disable();
    };
  }, []);

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

  /**
   * 일반 시작 핸들러.
   * 각서 규칙 생성(createRoomRule) → 타이머 시작(startTimer) 순으로 호출합니다.
   */
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

  /**
   * 강제 시작 핸들러.
   * NoSleep 활성화 → 각서 규칙 생성 → 강제 타이머 시작(미서명 멤버 자동 강퇴) 순으로 호출합니다.
   */
  const handleForceStartFocus = async () => {
    try {
      getNoSleep().enable();
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

  // phase 변경 감지: timer로 전환되면 타이머 페이지로, result면 결과 페이지로 이동
  useEffect(() => {
    if (phase === 'timer') {
      router.replace(`/room/${room.code}/timer`);
    } else if (phase === 'result') {
      router.replace(`/room/${room.code}/semi-result`);
    }
  }, [phase, room.code, router]);

  /**
   * 방 퇴장 핸들러.
   * 방장이면 방 폭파 경고, 일반 멤버면 퇴장 확인을 거칩니다.
   * 게스트 토큰이면 쿠키 삭제 + 쿼리 캐시 초기화 후 홈으로 이동합니다.
   */
  const handleLeaveRoom = async () => {
    const ok = await confirm({
      title: isHost
        ? `방장이 나가면 방이 폭파돼요.\n정말 나가시겠어요?`
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
      toast.error('퇴장 처리에 실패했어요.');
    }
  };

  /**
   * 강제 시작 버튼 핸들러.
   * 방장 여부 + 본인 서명 여부를 검증한 뒤 확인 다이얼로그를 띄웁니다.
   */
  const handleForceStart = async () => {
    if (!isHost) {
      return;
    }
    if (!isMeSigned) {
      toast.error('서명을 먼저 완료해주세요.');
      return;
    }
    const ok = await confirm({
      title: `강제로 시작하시겠어요?`,
      description: '서명하지 않은 멤버는 자동으로 강퇴돼요.',
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
          <HeaderTitle>각서</HeaderTitle>
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
            <p className='text-xl text-success'>감금이 시작돼요!</p>
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
              aria-disabled={!isMeSigned}
              type='button'
              className={cn(
                'flex-1 h-12 rounded-[14px] text-base font-bold bg-destructive',
                !isMeSigned &&
                  'opacity-50 pointer-events-auto hover:cursor-auto active:scale-100',
              )}
              onClick={handleForceStart}
            >
              강제 시작
            </Button>
          )}
          {isHost && (allSigned || memberCount === 1) && (
            <Button
              aria-disabled={!isMeSigned}
              type='button'
              disabled={startTimerMutation.isPending}
              onClick={async () => {
                if (!isMeSigned) {
                  toast.error('서명을 먼저 완료해주세요.');
                  return;
                }
                await handleStartFocus();
              }}
              className={cn(
                'flex-1 h-12 rounded-[14px] text-base font-bold',
                !isMeSigned &&
                  'opacity-50 pointer-events-auto hover:cursor-auto active:scale-100',
              )}
            >
              {startTimerMutation.isPending ? '시작 중...' : '감금 시작'}
            </Button>
          )}
        </div>
      </div>
      <ConfirmDialog {...confirmProps} />
    </MobileLayout>
  );
};

export default ContractForm;
