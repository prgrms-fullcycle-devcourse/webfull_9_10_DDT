'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { HeaderTitle } from '../layout/HeaderTitle';
import { BackButton } from '../layout/BackButton';
import {
  MyPageHistoryList,
  HistoryItem,
} from '@/components/mypage/MyPageHistoryList';
import { Button } from '@/components/ui/button';
import { getUsers } from '@/api/generated/users-사용자/users-사용자';

const PAGE_SIZE = 10;

const HISTORY_CACHE_KEY = 'mypage-history-cache';
const RESTORE_FLAG_KEY = 'mypageHistoryScrollRestore';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30분 지난 캐시는 무시

type HistoryCache = {
  history: HistoryItem[];
  total: number;
  page: number;
  scrollY: number;
  savedAt: number;
};
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
  // 복원할 스크롤 위치(목록이 그려진 뒤 적용)
  const pendingScrollRef = useRef<number | null>(null);
  // 최신 목록 스냅샷(언마운트 시 저장용)
  const snapshotRef = useRef({ history, total, page });
  // 최초 init 1회 실행 가드(dev StrictMode 이중 호출 방지)
  const initRef = useRef(false);
  // 마지막 스크롤 위치를 계속 기록(언마운트 시 window.scrollY가 0으로 리셋되는 경우 대비)
  const scrollYRef = useRef(0);

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
      setHistory((prev) =>
        nextPage === 1 ? sessions : [...prev, ...sessions],
      );
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

  // 최초 진입: '통합결과 복귀' 플래그 + 유효 캐시가 있으면 목록·스크롤을 복원하고,
  // 그 외(마이페이지에서 새로 들어옴 등)에는 평소처럼 1페이지를 로드한다.
  // setState는 마이크로태스크로 미뤄 cascading render를 막는다(react-hooks/set-state-in-effect).
  useEffect(() => {
    // dev StrictMode가 이 effect를 두 번 호출해도 init은 1회만 — 그러지 않으면
    // 첫 호출이 복원 플래그를 소비하고, 둘째 호출이 loadPage(1)로 복원본을 덮어쓴다.
    if (initRef.current) return;
    initRef.current = true;

    void Promise.resolve().then(() => {
      const shouldRestore = sessionStorage.getItem(RESTORE_FLAG_KEY) === '1';
      sessionStorage.removeItem(RESTORE_FLAG_KEY); // 1회성 소비

      let cache: HistoryCache | null = null;
      try {
        const raw = sessionStorage.getItem(HISTORY_CACHE_KEY);
        if (raw) cache = JSON.parse(raw) as HistoryCache;
      } catch {
        cache = null; // 손상된 캐시는 폐기
      }

      const isFresh = !!cache && Date.now() - cache.savedAt < CACHE_TTL_MS;
      if (shouldRestore && cache?.history?.length && isFresh) {
        setHistory(cache.history);
        setTotal(cache.total);
        setPage(cache.page);
        setIsLoading(false);
        pendingScrollRef.current = cache.scrollY;
      } else {
        void loadPage(1);
      }
    });
  }, [loadPage]);

  // 캐시로 채워진 목록이 실제로 그려진 뒤 스크롤 위치를 복원한다.
  // Next의 네비게이션 스크롤 리셋에 밀리지 않도록 몇 프레임에 걸쳐 재적용한다.
  useEffect(() => {
    if (pendingScrollRef.current == null || history.length === 0) return;
    const y = pendingScrollRef.current;
    pendingScrollRef.current = null;

    let tries = 0;
    const apply = () => {
      window.scrollTo(0, y);
      // 아직 목표 위치에 못 닿았으면(콘텐츠 렌더 지연·외부 리셋) 다음 프레임에 재시도
      if (++tries < 5 && Math.abs(window.scrollY - y) > 2) {
        requestAnimationFrame(apply);
      }
    };
    requestAnimationFrame(apply);
  }, [history]);

  // 최신 목록 상태를 ref에 반영(언마운트 시 정확한 값 저장용)
  useEffect(() => {
    snapshotRef.current = { history, total, page };
  }, [history, total, page]);

  // 스크롤 위치를 계속 기록하고, 화면을 떠날 때 목록·페이지·스크롤을 세션에 저장한다.
  // (복원 여부는 플래그로 결정되므로, 통합결과로 갈 때만 실제로 쓰인다)
  useEffect(() => {
    const onScroll = () => {
      scrollYRef.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);

      const { history, total, page } = snapshotRef.current;
      if (history.length === 0) return;
      try {
        sessionStorage.setItem(
          HISTORY_CACHE_KEY,
          JSON.stringify({
            history,
            total,
            page,
            // 언마운트 시점엔 window.scrollY가 0으로 리셋됐을 수 있어 마지막 기록값을 사용,
            // 혹시 더 큰 현재값이 있으면 그쪽을 택한다.
            scrollY: Math.max(scrollYRef.current, window.scrollY),
            savedAt: Date.now(),
          }),
        );
      } catch {
        // 저장 실패는 무시 — 복원만 생략될 뿐 동작에는 영향 없음
      }
    };
  }, []);

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
            <HeaderTitle>전체 참여 기록</HeaderTitle>
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
              <div ref={sentinelRef}>
                {isLoadingMore ? '불러오는 중...' : ''}
              </div>
            )}
          </div>
        )}
      </MobileLayout>
    </RequireAuth>
  );
}
