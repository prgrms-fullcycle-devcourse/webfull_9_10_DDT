// components/room/RoomNotFound.tsx
'use client';

import { useRouter } from 'next/navigation';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { BackButton } from '@/components/layout/BackButton';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { Button } from '@/components/ui/button';

interface RoomNotFoundProps {
  title?: string;
  description?: string;
  primaryMessage?: string;
}

export function RoomNotFound({
  title = '방 입장하기',
  primaryMessage = '존재하지 않거나 종료된 방이에요.',
  description = '방 코드를 다시 확인해주세요.',
}: RoomNotFoundProps) {
  const router = useRouter();

  return (
    <MobileLayout
      header={
        <>
          <BackButton />
          <HeaderTitle>{title}</HeaderTitle>
        </>
      }
    >
      <div className='flex flex-col items-center gap-3 pt-16 text-center'>
        <p className='text-base font-bold text-white'>{primaryMessage}</p>
        <p className='text-sm text-white/50'>{description}</p>
        <Button
          onClick={() => router.push('/')}
          className='mt-3 h-12 rounded-[14px] px-6 font-bold text-white'
          style={{
            background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)',
          }}
        >
          홈으로
        </Button>
      </div>
    </MobileLayout>
  );
}
