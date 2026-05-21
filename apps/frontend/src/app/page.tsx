'use client';

import { Button } from '@/components/ui/button';
import { Lock, Timer, Gavel } from 'lucide-react';
import Image from 'next/image';
import { TextIcon } from '@/components/features/textIcon';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const RoomPage = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return typeof document !== 'undefined' && document.cookie.includes('accessToken=');
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'login-success') {
        setIsLoggedIn(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleGoogleLogin = () => {
    window.open('/auth/google', 'Google Login', 'width=500,height=600');
  };

  return (
    <div className='relative min-h-screen w-full flex flex-col items-center justify-center p-6 text-white'>
      <div
        className='absolute inset-0 bg-cover bg-center bg-no-repeat -z-10'
        style={{ backgroundImage: "url('/images/backgroundMain.webp')" }}
      />
      <div className='absolute inset-0 bg-black/60 -z-10' />

      <div className='absolute top-0 right-0 p-6'>
        {isLoggedIn ? (
          <Button variant='outline' asChild>
            <Link href='/my-page'>마이페이지</Link>
          </Button>
        ) : (
          <Button variant='outline' onClick={handleGoogleLogin}>
            로그인
          </Button>
        )}
      </div>

      <div className='flex flex-col w-full max-w-xs gap-8'>
        <div className='text-left space-y-4'>
          <div className='mb-14'>
            <Image
              src='/images/logo.webp'
              alt='감옥 로고'
              width={150}
              height={60}
            />
          </div>

          <p className='text-xl leading-relaxed'>
            남들이 딴짓할 때,
            <br />
            우리는{' '}
            <span className='text-third font-semibold'>
              서로를 가두고
              <br />
              집중한다.
            </span>
          </p>
          <p className='text-sm text-gray-400 mb-2'>
            계약하고, 집중하고,
            <br /> 벌칙으로 완성하자.
          </p>
        </div>

        <div className='flex flex-col gap-3 items-center'>
          <Button variant='default' size='main' className='w-full'>
            <Lock className='mr-2 h-4 w-4' /> 방 만들기
          </Button>
          <Button
            variant='outline'
            size='main'
            className='w-full bg-transparent border-primary'
          >
            코드로 입장하기
          </Button>
        </div>

        <div className='grid grid-cols-3 gap-4 w-full border-t border-white/10 pt-8 text-third'>
          <TextIcon
            icon={<Lock className='h-8 w-8 text-third' />}
            title='서로를 감시'
            desc='이탈은 기록되고 투명하게 공개돼요.'
          />
          <TextIcon
            icon={<Timer className='h-8 w-8 text-third' />}
            title='집중 타이머'
            desc='공정한 타이머로 함께 집중해요.'
          />
          <TextIcon
            icon={<Gavel className='h-8 w-8 text-third' />}
            title='벌칙은 확실하게'
            desc='계약한 벌칙은 끝까지 책임져요.'
          />
        </div>
      </div>
    </div>
  );
};

export default RoomPage;
