'use client';

import { Button } from '@/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
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
import { startTermsAgreementLogin } from '@/lib/authNavigation';
import { useActiveRoom, getActiveRoomPath } from '@/hooks/useActiveRoom';
import { cn } from '@/lib/utils';
import bgMain from '../../../public/images/mainBackground.webp';
import logoImg from '../../../public/images/logo.webp';

const MAX_ROOM_MEMBERS = 10;

const PHASE_LABEL: Record<string, string> = {
  lobby: '입장 전',
  contract: '각서 작성 중',
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
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const activeRoom = useActiveRoom();

  const handleRestore = () => {
    if (!activeRoom) return;
    router.push(getActiveRoomPath(activeRoom));
  };

  const handleOpenTerms = () => {
    startTermsAgreementLogin(router.push);
  };

  const handleLoginForCreateRoom = () => {
    startTermsAgreementLogin(router.push, '/room');
    setShowLoginDialog(false);
  };

  const handleLogout = () => {
    logout();
  };

  const handleCreateRoom = () => {
    if (isLoading) return;
    if (!isLoggedIn) {
      setShowLoginDialog(true);
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
        sizes='100vw'
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
          width={160}
          height={81}
          priority
          placeholder='blur'
        />

        <p className='mt-7 text-[26px] font-bold leading-snug'>
          남들이 딴짓할때
          <br />
          우리는 서로를 감시하고
          <br />
          집중한다.
        </p>

        <span className='mt-5 inline-block w-fit rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white/75 '>
          서명하고 집중하고 벌칙으로 마무리한다.
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
              입장하실 방 코드를 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-2 py-2'>
            <InputOTP
              maxLength={8}
              pattern='^[A-Za-z0-9_-]*$'
              value={roomCode}
              onChange={(value) => setRoomCode(value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEnterByCode();
              }}
              containerClassName='w-full'
            >
              <InputOTPGroup className='w-full justify-between gap-1.5'>
                {Array.from({ length: 8 }, (_, i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className='h-12 flex-1 rounded-md border border-white/15 bg-black/40 shadow-none first:rounded-l-md last:rounded-r-md data-[active=true]:ring-2 data-[active=true]:ring-ring/30 dark:bg-black/40'
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
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

      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>회원만 생성할 수 있어요.</DialogTitle>
            <DialogDescription>
              방을 만들기 위해서는 로그인이 필요합니다.
              <br />
              로그인 하시겠어요?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='secondary'
              className='flex-1 h-12 rounded-lg'
              onClick={() => setShowLoginDialog(false)}
            >
              아니요
            </Button>
            <Button
              onClick={handleLoginForCreateRoom}
              className='flex-1 h-12 rounded-lg font-bold'
            >
              로그인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
