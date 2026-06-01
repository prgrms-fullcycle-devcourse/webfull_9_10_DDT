'use client';

import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { HeaderTitle } from '../layout/HeaderTitle';
import { BackButton } from '../layout/BackButton';
import { MyPageHistoryList, HistoryItem } from '@/components/mypage/MyPageHistoryList';
import { getUsers } from '@/api/generated/users-사용자/users-사용자';

type ApiEnvelope<T> = {
  data?: T;
};

const PAGE_SIZE = 10;

const getCookieToken = () => {
  if (typeof document === 'undefined') return undefined;
  return document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/)?.[1];
};

export function MyPageHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const hasMore = history.length < total;

  const loadPage = useCallback(async (nextPage: number) => {
    if (loadingRef.current) return;

    const token = getCookieToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    loadingRef.current = true;
    if (nextPage === 1) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const axiosInstance = axios.create({ baseURL: apiUrl });
      const usersApi = getUsers(axiosInstance);

      const response = await usersApi.usersControllerGetMyHistory(
        { page: nextPage, limit: PAGE_SIZE },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const result = response.data as ApiEnvelope<{
        total: number;
        page: number;
        sessions?: HistoryItem[];
      }>;

      const sessions = result.data?.sessions ?? [];
      setTotal(result.data?.total ?? 0);
      setPage(nextPage);
      setHistory((prev) => (nextPage === 1 ? sessions : [...prev, ...sessions]));
      setErrorMessage('');
    } catch {
      if (nextPage === 1) setHistory([]);
      setErrorMessage('참여 기록을 불러오지 못했습니다.');
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  // 최초 1페이지 로드
  useEffect(() => {
    void loadPage(1);
  }, [loadPage]);

  // 무한 스크롤: 센티넬이 보이면 다음 페이지 로드
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current) {
          void loadPage(page + 1);
        }
      },
      { rootMargin: '120px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, page, loadPage]);

  return (
    <RequireAuth>
      <MobileLayout
        header={
          <>
            <BackButton />
            <HeaderTitle>
                내 참여 기록
            </HeaderTitle>
          </>
        }
      >
        <MyPageHistoryList
          history={history}
          isLoading={isLoading}
          errorMessage={errorMessage}
          errorOnlyWhenEmpty
          emptyMessage='참여 기록이 없습니다.'
          loadingMessage='불러오는 중...'
        />

        {hasMore && (
          <div
            ref={sentinelRef}
            className='py-4 text-center text-[13px] text-[#898793]'
          >
            {isLoadingMore ? '불러오는 중...' : ''}
          </div>
        )}
      </MobileLayout>
    </RequireAuth>
  );
}
