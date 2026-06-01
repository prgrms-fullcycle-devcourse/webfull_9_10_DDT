'use client';

import { Button } from '@/components/ui/button';
import { Lock, Timer, Gavel } from 'lucide-react';
import Image from 'next/image';
import { TextIcon } from '@/components/features/textIcon';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CenterLayout } from '@/components/layout/centerLayout';

const RoomPage = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const syncLoginStatus = () => {
      const hasToken = typeof document !== 'undefined' && document.cookie.includes('access_token=');
      setIsLoggedIn(hasToken);
    };

    syncLoginStatus();

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'OAUTH_SUCCESS') {
        setIsLoggedIn(true);
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('pageshow', syncLoginStatus);
    window.addEventListener('focus', syncLoginStatus);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('pageshow', syncLoginStatus);
      window.removeEventListener('focus', syncLoginStatus);
    };
  }, []);

  const handleOpenTerms = () => {
    window.open(
      '/terms',
      'Terms Agreement',
      'width=400,height=730,resizable=no,status=no,toolbar=no,menubar=no,location=no',
    );
  };

  return (
    <CenterLayout>
      <div className='absolute top-0 right-0 p-4 md:p-6'>
        {isLoggedIn ? (
          <Button variant='outline' asChild>
            <Link href='/mypage'>마이페이지</Link>
          </Button>
        ) : (
          <Button variant='outline' onClick={handleOpenTerms}>
            로그인
          </Button>
        )}
      </div>

      <div className='text-left space-y-4 pt-16 md:pt-0 md:text-center md:flex md:flex-col md:items-center'>
        <div className='mb-10 md:mb-14'>
          <Image
            src='/images/logo.webp'
            alt='감옥 로고'
            width={150}
            height={60}
            className='md:w-45 h-auto'
          />
        </div>

        <p className='text-xl md:text-2xl leading-relaxed'>
          남들이 딴짓할 때,
          <br className='md:hidden' /> 우리는{' '}
          <span className='text-third font-semibold'>
            서로를 가두고 <br className='md:hidden' /> 집중한다.
          </span>
        </p>
        <p className='text-sm md:text-base text-gray-400 mb-2'>
          계약하고, 집중하고, <br className='md:hidden' />
          벌칙으로 완성하자.
        </p>
      </div>

      <div className='flex flex-col md:flex-row gap-3 items-center justify-center w-full max-w-xs mx-auto md:max-w-md'>
        <Button variant='default' size='main' className='w-full'>
          <Lock className='mr-2 h-4 w-4' /> 방 만들기
        </Button>
        <Button variant='outline' size='main' className='w-full bg-transparent'>
          코드로 입장하기
        </Button>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 w-full border-t border-white/10 pt-8 text-third'>
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
    </CenterLayout>
  );
};

export default RoomPage;