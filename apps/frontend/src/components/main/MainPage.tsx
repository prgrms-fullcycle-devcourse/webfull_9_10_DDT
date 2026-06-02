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
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

export const MainPage = () => {
  const router = useRouter();
  const me = useAuthStore((state) => state.me);
  const logout = useAuthStore((state) => state.logout);
  const fetchMe = useAuthStore((state) => state.fetchMe);
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [roomCode, setRoomCode] = useState('');

  // 로그인 팝업에서 OAUTH_SUCCESS를 받으면 회원 정보 갱신
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'OAUTH_SUCCESS') {
        void fetchMe();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchMe]);

  const handleOpenTerms = () => {
    window.open(
      '/terms',
      'Terms Agreement',
      'width=400,height=730,resizable=no,status=no,toolbar=no,menubar=no,location=no',
    );
  };

  const handleLogout = () => {
    logout();
  };

  const isCodeValid = roomCode.trim().length === 8;

  const handleEnterByCode = () => {
    const code = roomCode.trim();
    if (code.length !== 8) return;
    router.push(`/room/${code}`);
  };

  return (
    <div className='relative min-h-screen w-full overflow-hidden text-white'>
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
        {me?.role === 'user' ? (
          <Button
            variant='outline'
            size='sm'
            asChild
            className='border-[#914CFF]! text-white/80 hover:text-white'
          >
            <Link href='/mypage'>마이페이지</Link>
          </Button>
        ) : me?.role === 'guest' ? (
          <Button
            variant='outline'
            size='sm'
            onClick={handleLogout}
            className='border-[#914CFF]! text-white/80 hover:text-white'
          >
            로그아웃
          </Button>
        ) : (
          <Button
            variant='outline'
            size='sm'
            onClick={handleOpenTerms}
            className='border-[#914CFF]! text-white/80 hover:text-white'
          >
            로그인
          </Button>
        )}
      </div>

      {/* 본문 */}
      <div className='relative z-10 flex min-h-screen flex-col px-6 pb-8 pt-20'>
        <Image
          src='/images/logo.webp'
          alt='감옥'
          width={160}
          height={64}
          priority
          className='h-auto w-[160px]'
        />

        <p className='mt-7 text-[26px] font-bold leading-snug'>
          남들이 딴짓할때
          <br />
          우리는 서로를 가두고
          <br />
          집중한다.
        </p>

        <span className='mt-5 inline-block w-fit rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white/70 backdrop-blur-sm'>
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
            className='w-full rounded-[14px] border-[#914CFF]! bg-[#242136]! text-[15px] font-bold text-white/90 transition hover:bg-[#2A2640]!'
          >
            방 코드로 입장하기
          </Button>
          <Button
            size='main'
            onClick={() => router.push('/room')}
            className='w-full rounded-[14px] font-bold text-white'
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)',
              boxShadow: '0 0 40px rgba(124,58,237,0.45)',
            }}
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
              variant='ghost'
              className='flex-1 py-6! border border-white/20'
              onClick={() => setShowCodeDialog(false)}
            >
              취소
            </Button>
            <Button
              disabled={!isCodeValid}
              onClick={handleEnterByCode}
              className='flex-1 py-6!'
            >
              입장하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
