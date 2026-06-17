'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { RefreshCcw, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MyPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // ✨ Sentry 로 에러 로그를 전송하여 모니터링합니다.
    Sentry.captureException(error);
    console.error('MyPage Section Error:', error);
  }, [error]);

  return (
    <MobileLayout
      header={
        <HeaderTitle align='center' className='text-destructive'>
          안내
        </HeaderTitle>
      }
    >
      <div className='flex h-[70vh] flex-col items-center justify-center gap-4 text-center'>
        <div className='flex h-14 w-16 items-center justify-center rounded-full bg-destructive/15'>
          <AlertCircle className='h-8 w-8 text-destructive' />
        </div>

        <div className='flex flex-col gap-2'>
          <h2 className='text-lg font-bold text-white'>
            기록을 불러오지 못했습니다
          </h2>
          <p className='text-sm text-muted-foreground'>
            일시적인 오류일 수 있습니다. 아래 버튼을 눌러보세요.
          </p>
        </div>

        <div className='mt-4 flex w-full max-w-60 flex-col gap-3'>
          <Button
            onClick={() => reset()}
            className='h-12 w-full rounded-xl font-bold'
          >
            <RefreshCcw className='mr-2 h-4 w-4' /> 다시 시도
          </Button>
          <Button
            variant='outline'
            onClick={() => router.push('/')}
            className='h-12 w-full rounded-xl border-white/20'
          >
            홈 화면으로 이동
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
