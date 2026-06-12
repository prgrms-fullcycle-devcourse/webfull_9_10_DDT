'use client';

import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { startTermsAgreementLogin } from '@/lib/authNavigation';
import { useActiveRoom, getActiveRoomPath } from '@/hooks/useActiveRoom';
import { cn } from '@/lib/utils';
import bgMain from '../../../public/images/mainBackground.webp';
import logoImg from '../../../public/images/logo.webp';

const MAX_ROOM_MEMBERS = 10;

const PHASE_LABEL: Record<string, string> = {
  lobby: '입장 전',
  contract: '계약서 작성 중',
  timer: '집중 중',
};

function StatBox({
  label,
  value,
  truncate,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div className='rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-center backdrop-blur-sm'>
      <p className='text-[11px] text-white/55'>{label}</p>
      <p
        className={cn(
          'mt-1 text-sm font-semibold text-white',
          truncate && 'truncate',
        )}
      >
        {value}
      </p>
    </div>
  );
}

export const MainPage = () => {
  const router = useRouter();
  const { me, logout, isLoggedIn, isLoading } = useAuth();
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const activeRoom = useActiveRoom();

  const handleRestore = () => {
    if (!activeRoom) return;
    router.push(getActiveRoomPath(activeRoom));
  };

  const handleOpenTerms = () => {
    startTermsAgreementLogin(router.push);
  };

  const handleLogout = () => {
    logout();
  };

  const handleCreateRoom = () => {
    if (isLoading) return;
    if (!isLoggedIn) {
      toast.error('로그인하고 바로 이어가세요.', { id: 'auth-required' });
      return;
    }
    router.push('/room');
  };

  const isCodeValid = roomCode.trim().length === 8;

  const handleEnterByCode = () => {
    const code = roomCode.trim();
    if (code.length !== 8) return;
    router.push(`/room/${code}`);
  };

  return (
    <div className='relative min-h-dvh w-full overflow-hidden text-white'>
      <Image
        src={bgMain}
        alt=''
        fill
        priority
        placeholder='blur'
        sizes='(max-width: 390px) 100vw, 390px'
        className='object-cover'
      />

      <div className='absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80' />

      <div className='absolute right-0 top-0 z-20 p-4'>
        {isLoading ? (
          <div
            aria-hidden
            className='h-9 w-22 rounded-sm border border-transparent'
          />
        ) : isLoggedIn && me?.role === 'user' ? (
          <Button
            variant='ghost'
            size='lg'
            asChild
            className='border border-white/25 bg-black/35 backdrop-blur-sm px-3 py-3 rounded-sm!'
          >
            <Link href='/mypage'>마이페이지</Link>
          </Button>
        ) : isLoggedIn && me?.role === 'guest' ? (
          <Button
            variant='ghost'
            size='lg'
            onClick={handleLogout}
            className='border border-white/25 bg-black/35 backdrop-blur-sm px-3 py-3 rounded-sm!'
          >
            로그아웃
          </Button>
        ) : (
          <Button
            variant='ghost'
            size='lg'
            onClick={handleOpenTerms}
            className='border border-white/25 bg-black/35 backdrop-blur-sm px-3 py-3 rounded-sm!'
          >
            로그인
          </Button>
        )}
      </div>

      <div className='relative z-10 flex min-h-dvh flex-col px-6 pb-8 pt-20'>
        <Image
          src={logoImg}
          alt='감옥'
          width={596}
          height={302}
          priority
          placeholder='blur'
          className='w-[160px] h-auto'
        />

        <p className='mt-7 text-[26px] font-bold leading-snug'>
          남들이 딴짓할때
          <br />
          우리는 서로를 가두고
          <br />
          집중한다.
        </p>

        <span className='mt-5 inline-block w-fit rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white/75 '>
          계약하고 집중하고 벌칙으로 완성한다
        </span>

        <div className='flex-1' />

        {activeRoom ? (
          <div className='flex w-full flex-col gap-3'>
            <div className='grid grid-cols-2 gap-2'>
              <StatBox
                label='참여 중 방 이름'
                value={activeRoom.title}
                truncate
              />
              <StatBox
                label='참여 중 멤버 수'
                value={`${activeRoom.memberCount} / ${MAX_ROOM_MEMBERS}`}
              />
              <StatBox
                label='방 상태'
                value={PHASE_LABEL[activeRoom.phase] ?? activeRoom.phase}
              />
              <StatBox
                label='방장 여부'
                value={activeRoom.isHost ? '방장' : '참여자'}
              />
            </div>
            <Button
              size='main'
              onClick={handleRestore}
              className='rounded-[14px] font-bold'
            >
              방 복귀하기
            </Button>
          </div>
        ) : (
          <div className='flex w-full flex-col gap-3'>
            <Button
              variant='outline'
              size='main'
              onClick={() => setShowCodeDialog(true)}
              className='bg-black/40!'
            >
              방 코드로 입장하기
            </Button>
            <Button
              size='main'
              onClick={handleCreateRoom}
              className='rounded-[14px] font-bold'
            >
              방만들기
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>방 코드로 입장</DialogTitle>
            <DialogDescription>
              초대받은 방 코드를 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <FormInput
            type='text'
            placeholder='방 코드 8자리를 입력해주세요'
            maxLength={8}
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEnterByCode();
            }}
          />
          <DialogFooter>
            <Button
              variant='secondary'
              className='flex-1 h-12 rounded-lg'
              onClick={() => setShowCodeDialog(false)}
            >
              취소
            </Button>
            <Button
              disabled={!isCodeValid}
              onClick={handleEnterByCode}
              className='flex-1 h-12 rounded-lg font-bold'
            >
              입장하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
