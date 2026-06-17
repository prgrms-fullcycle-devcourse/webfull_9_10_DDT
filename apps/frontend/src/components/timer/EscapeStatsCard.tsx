'use client';

import { formatDuration } from '@/lib/format';

interface EscapeStatsCardProps {
  isFocus: boolean;
  myEscapeMs: number;
}

/**
 * 휴식 시간에만 보이는 카드. 내 총 이탈 시간과 "1분 전 알림" 안내를 표시한다.
 * 집중 시간에는 렌더하지 않는다.
 *
 * @param isFocus - 집중 시간 여부 (true면 미표시)
 * @param myEscapeMs - 내 누적 이탈 시간(ms)
 */
export function EscapeStatsCard({ isFocus, myEscapeMs }: EscapeStatsCardProps) {
  if (isFocus) return null;

  return (
    <div className='flex justify-center flex-col gap-2 text-center mt-10 w-full max-w-sm text-destructive'>
      <div className='flex flex-col items-center justify-center bg-muted/20  rounded-[14px] px-4 py-3'>
        <p className='text-xs mb-1'>총 이탈 시간</p>
        <p className='text-2xl font-bold tracking-wider '>
          {myEscapeMs > 0 ? formatDuration(myEscapeMs) : '0초'}
        </p>
      </div>

      <div className='flex items-center justify-center gap-2 bg-muted/20  rounded-[14px] px-4 py-3 text-xs text-[#FACC15]'>
        <svg
          className='w-4 h-4 shrink-0'
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
          />
        </svg>
        <span>시작 1분 전에 알림이 울려요.</span>
      </div>
    </div>
  );
}
