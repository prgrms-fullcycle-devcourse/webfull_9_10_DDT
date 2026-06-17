'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { Home } from 'lucide-react';

export default function RootError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error('Root Global Error:', error);
  }, [error]);

  return (
    <MobileLayout
      header={
        <HeaderTitle align='center' className='text-destructive'>
          시스템 안내
        </HeaderTitle>
      }
    >
      <div className='flex h-[70vh] flex-col items-center justify-center gap-4 text-center'>
        <div className='text-4xl animate-pulse'>🔓</div>

        <div className='flex flex-col gap-2 px-2'>
          <h2 className='text-lg font-bold text-white'>
            예기치 못한 문제가 발생했습니다
          </h2>
          <p className='text-sm text-muted-foreground leading-relaxed'>
            서비스 이용에 불편을 드려 죄송합니다. <br />
            안전한 처리를 위해 홈 화면으로 이동해 주세요.
          </p>
        </div>

        <div className='mt-4 flex w-full max-w-60 flex-col gap-3'>
          <Button
            onClick={() => {
              // ✨ 전역 캐시를 비우고 안전하게 새로고침하며 홈으로 이동합니다.
              window.location.replace('/');
            }}
            className='h-12 w-full rounded-xl font-bold'
          >
            <Home className='mr-2 h-4 w-4' /> 홈으로 가기
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
