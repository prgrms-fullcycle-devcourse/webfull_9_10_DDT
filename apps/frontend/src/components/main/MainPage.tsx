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

export const MainPage = () => {
  const router = useRouter();
  const { me, logout, isLoggedIn, isLoading } = useAuth();
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [roomCode, setRoomCode] = useState('');

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
      {/* 배경 이미지 */}
      <Image
        src='/images/mainBackground.webp'
        alt=''
        fill
        priority
        sizes='(max-width: 390px) 100vw, 390px'
        className='object-cover'
      />
      {/* 하단 가독성용 그라데이션 */}
      <div className='absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80' />

      {/* 우측 상단 로그인 / 마이페이지 */}
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

      {/* 본문 */}
      <div className='relative z-10 flex min-h-dvh flex-col px-6 pb-8 pt-20'>
        <Image
          src='/images/logo.webp'
          alt='감옥'
          width={596}
          height={302}
          priority
          className="w-[160px] h-auto"
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

        {/* 남은 공간 */}
        <div className='flex-1' />

        {/* 하단 버튼 */}
        <div className='flex w-full flex-col gap-3'>
          <Button
            variant='outline'
            size='main'
            onClick={() => setShowCodeDialog(true)}
            className='w-full rounded-[14px] border-[#914CFF]! bg-[#242136]! font-bold text-white/90 transition hover:bg-[#2A2640]!'
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
      </div>

      {/* 코드 입력 다이얼로그 */}
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
