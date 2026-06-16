'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { HeaderTitle } from '../layout/HeaderTitle';
import { BackButton } from '../layout/BackButton';
import { MyPageHistoryList, HistoryItem } from '@/components/mypage/MyPageHistoryList';
import { Button } from '@/components/ui/button';
import { getUsers } from '@/api/generated/users-사용자/users-사용자';

const PAGE_SIZE = 10;

/**
 * 전체 참여 기록 화면. IntersectionObserver 기반 무한 스크롤로 기록을 페이지 단위(10건)로 누적 로드한다.
 * 전체(1페이지) 실패와 추가 페이지(부분) 실패를 분리해 처리하며, 추가 로드 실패 시 자동 재요청을 멈추고 재시도 버튼을 노출한다.
 */
export function MyPageHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState(''); // 1페이지(전체) 실패
  const [loadMoreError, setLoadMoreError] = useState(''); // 추가 페이지(부분) 실패

  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const hasMore = history.length < total;

  const loadPage = useCallback(async (nextPage: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      // baseURL·토큰·응답 언래핑은 전역 axiosClient 인터셉터가 처리한다.
      const response = await getUsers().usersControllerGetMyHistory({
        page: nextPage,
        limit: PAGE_SIZE,
      });

      const data = response.data as {
        total: number;
        page: number;
        sessions?: HistoryItem[];
      };

      const sessions = data?.sessions ?? [];
      setTotal(data?.total ?? 0);
      setPage(nextPage);
      setHistory((prev) => (nextPage === 1 ? sessions : [...prev, ...sessions]));
      setErrorMessage('');
      setLoadMoreError('');
    } catch {
      if (nextPage === 1) {
        // 전체 실패: 목록을 비우고 전체 에러 표시
        setHistory([]);
        setErrorMessage('불러오지 못했어요.');
      } else {
        // 부분 실패: 기존 목록은 유지하고, 추가 로드 에러만 표시
        setLoadMoreError('불러오지 못했어요.');
      }
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  // 최초 1페이지 로드
  // effect 본문에서 동기적으로 setState가 일어나지 않도록 마이크로태스크로 미뤄 호출한다
  // (react-hooks/set-state-in-effect: cascading render 방지)
  useEffect(() => {
    void Promise.resolve().then(() => loadPage(1));
  }, [loadPage]);

  const loadMore = useCallback(() => {
    setIsLoadingMore(true);
    setLoadMoreError('');
    void loadPage(page + 1);
  }, [loadPage, page]);

  // 무한 스크롤: 센티넬이 보이면 다음 페이지 로드.
  // 추가 로드 에러가 떠 있으면 자동 재요청을 멈춘다(동일 실패 무한 반복 방지).
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadMoreError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current) {
          setIsLoadingMore(true);
          void loadPage(page + 1);
        }
      },
      { rootMargin: '120px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, page, loadPage, loadMoreError]);

  return (
    <RequireAuth>
      <MobileLayout
        header={
          <>
            <BackButton />
            <HeaderTitle>
                전체 참여 기록
            </HeaderTitle>
          </>
        }
      >
        <MyPageHistoryList
          history={history}
          isLoading={isLoading}
          errorMessage={errorMessage}
          errorOnlyWhenEmpty
          emptyMessage='참여 기록이 없어요.'
          loadingMessage='불러오는 중...'
          from='mypage-history'
        />

        {hasMore && (
          <div className='py-4 text-center text-[13px] text-[#898793]'>
            {loadMoreError ? (
              <div className='flex flex-col items-center gap-2'>
                <span className='text-[#FFB3C0]'>{loadMoreError}</span>
                <Button
                  variant='ghost'
                  size='sm'
                  className='border border-white/20'
                  onClick={loadMore}
                >
                  재시도 하기
                </Button>
              </div>
            ) : (
              // 센티넬: 에러가 없을 때만 화면에 두어 자동 로드를 트리거한다.
              <div ref={sentinelRef}>{isLoadingMore ? '불러오는 중...' : ''}</div>
            )}
          </div>
        )}
      </MobileLayout>
    </RequireAuth>
  );
}
