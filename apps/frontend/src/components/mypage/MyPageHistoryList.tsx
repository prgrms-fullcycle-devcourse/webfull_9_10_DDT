'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatDateWithDots, formatDuration } from '@/lib/format';
import { ResultFromSource, setResultFrom } from '@/lib/navigation';

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

/**
 * 이탈 시간에 따라 텍스트 색상 클래스를 반환한다.
 *
 * @param milliseconds - 내 총 이탈 시간(ms)
 * @returns 이탈이 사실상 없으면(1초 미만) 성공색, 그 외에는 경고색 Tailwind 클래스
 */
const getPenaltyTextColor = (milliseconds: number) => {
  // 1초 미만 이탈은 '이탈 없음(올클리어)'으로 간주해 성공색으로 표시한다.
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

/**
 * 참여 기록 목록을 로딩/에러/빈 상태와 함께 렌더하는 공용 리스트 컴포넌트.
 * 마이페이지(미리보기)와 전체 기록 화면 양쪽에서 재사용한다.
 *
 * @param history - 표시할 기록 항목 배열
 * @param isLoading - 로딩 중이면 로딩 메시지를 표시
 * @param errorMessage - 에러 메시지 (errorOnlyWhenEmpty와 조합되어 표시 여부 결정)
 * @param emptyMessage - 기록이 없을 때 문구
 * @param loadingMessage - 로딩 중 문구
 * @param errorOnlyWhenEmpty - true면 목록이 비었을 때만 에러를 노출(부분 데이터가 있으면 기존 목록 유지)
 * @param chevronDirection - 항목 우측 화살표 방향
 * @param from - 결과 화면이 '뒤로가기' 목적지를 알 수 있도록 sessionStorage에 저장할 진입 출처
 */
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

  // 항목 클릭으로 통합 결과 화면에 진입하기 전, 출처를 저장해 결과 화면의 닫기/뒤로가기가 올바른 곳으로 돌아가게 한다.
  const handleClick = () => {
    if (from) {
      setResultFrom(from as ResultFromSource);
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
            className='flex min-h-23.75 items-center justify-between rounded-md bg-[#1D1C31] px-3.5 py-4 transition hover:bg-[#24223A] active:scale-[0.98]'
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
