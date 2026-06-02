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
import { useAuthStore } from '@/store/useAuthStore';
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

interface ContractFormValues {
  focusMin: number;
  breakMin: number;
  rounds: number;
}

const ContractForm = () => {
  const router = useRouter();
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
    applyAll,
  } = useYjsContract(room.code, !!me, isHost);

  const { confirm, confirmProps } = useConfirm();

  const methods = useForm<ContractFormValues>({
    values: fields,
    defaultValues: { focusMin: 0, breakMin: 0, rounds: 0 },
  });

  const handleLeaveRoom = async () => {
    const ok = await confirm({
      title: isHost
        ? '방장이 나가면 방이 폭파됩니다. 정말 나가시겠어요?'
        : '정말 방에서 나가시겠어요?',
      confirmText: '나가기',
      variant: 'destructive',
    });
    if (!ok) {
      return;
    }

    try {
      await getRoomApi().roomControllerLeaveRoom(room.code);
      router.replace('/');
    } catch {
      toast.error('퇴장 처리에 실패했습니다.');
    }
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
          <BackButton />
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
        <div className='flex flex-col gap-5 bg-(--surface) rounded-xl'>
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
                  removeTier,
                  fieldOwners,
                  handleFocus,
                  handleBlur,
                }}
              />
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
            onClick={handleLeaveRoom}
          >
            나가기
          </Button>
          {isHost && !allSigned && (
            <Button
              type='button'
              disabled={!isMeSigned}
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
      <ConfirmDialog {...confirmProps} />
    </MobileLayout>
  );
};

export default ContractForm;
