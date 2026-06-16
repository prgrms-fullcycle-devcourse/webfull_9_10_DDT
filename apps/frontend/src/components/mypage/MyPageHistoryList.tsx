'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatDateWithDots, formatDuration } from '@/lib/format';

export type HistoryItem = {
  roomCode: string;
  roomTitle: string;
  profileImage?: string;
  totalEscapeMs: number;
  penaltyTier: number;
  memberCount: number;
  endedAt: string;
  gaveUp?: boolean;
};

const getPenaltyTextColor = (milliseconds: number) => {
  return milliseconds < 1000 ? 'text-success' : 'text-destructive';
};

interface MyPageHistoryListProps {
  history: HistoryItem[];
  isLoading: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  errorOnlyWhenEmpty?: boolean;
  chevronDirection?: 'left' | 'right';
  from?: string;
}

export const MyPageHistoryList = ({
  history,
  isLoading,
  errorMessage,
  emptyMessage = '최근 참여 기록이 없습니다.',
  loadingMessage = '불러오는 중...',
  errorOnlyWhenEmpty = false,
  chevronDirection = 'right',
  from,
}: MyPageHistoryListProps) => {
  const shouldShowError =
    !!errorMessage && (!errorOnlyWhenEmpty || history.length === 0);
  const chevronClassName =
    chevronDirection === 'left'
      ? 'ml-3 rotate-180 text-[#8A8896]'
      : 'ml-3 shrink-0 text-[#8A8896]';

  const handleClick = () => {
    if (from) {
      sessionStorage.setItem('totalResultFrom', from);
      // 전체 참여 기록 → 통합결과 진입일 때만, 복귀 시 스크롤 복원용 1회성 플래그를 남긴다
      if (from === 'mypage-history') {
        sessionStorage.setItem('mypageHistoryScrollRestore', '1');
      }
    }
  };

  return (
    <div className='space-y-3'>
      {isLoading ? (
        <div className='rounded-md bg-[#1D1C31] px-3.5 py-6 text-center text-[13px] text-[#898793]'>
          {loadingMessage}
        </div>
      ) : shouldShowError ? (
        <div className='rounded-md bg-[#1D1C31] px-3.5 py-6 text-center text-[13px] text-[#FF606B]'>
          {errorMessage}
        </div>
      ) : history.length === 0 ? (
        <div className='rounded-md bg-[#1D1C31] px-3.5 py-6 text-center text-[13px] text-[#898793]'>
          {emptyMessage}
        </div>
      ) : (
        history.map((item) => (
          <Link
            key={item.roomCode}
            href={`/room/${item.roomCode}/total-result`}
            onClick={handleClick}
            className='flex min-h-[95px] items-center justify-between rounded-md bg-[#1D1C31] px-3.5 py-4 transition hover:bg-[#24223A] active:scale-[0.98]'
          >
            <div className='min-w-0'>
              <p className='mb-1 text-[12px] font-medium text-[#747281]'>
                {formatDateWithDots(item.endedAt)}
              </p>
              <p className='mb-2 truncate text-[17px] font-extrabold leading-6 text-white'>
                {item.roomTitle}
              </p>
              <p className='text-[12px] font-medium text-[#A5A3AF]'>
                참여 {item.memberCount}명 <span className='text-[10px]'>|</span>
                <span
                  className={`ml-2 ${getPenaltyTextColor(item.totalEscapeMs)}`}
                >
                  내 이탈 {formatDuration(item.totalEscapeMs)}
                </span>
                {item.gaveUp && (
                  <>
                    <span className='ml-2 text-[10px]'>|</span>
                    <span className='ml-2 text-destructive'>탈옥</span>
                  </>
                )}
              </p>
            </div>
            <ChevronRight
              className={chevronClassName}
              size={17}
              strokeWidth={1.8}
            />
          </Link>
        ))
      )}
    </div>
  );
};
