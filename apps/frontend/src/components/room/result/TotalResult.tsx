'use client';
import { useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { getResultApi } from '@/api/generated/result-api-결과-조회/result-api-결과-조회';
import { Button } from '@/components/ui/button';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { CloseButton } from '@/components/layout/CloseButton';
import { isMobileOrTablet } from '@/lib/device';
import { useAuth } from '@/hooks/useAuth';
import { useBlockBrowserBack } from '@/hooks/useBlockBrowserBack';
import { isGuestAccessToken, clearAccessTokenCookie } from '@/lib/authToken';
import {
  getCloseTarget,
  clearResultFrom,
  getResultFrom,
} from '@/lib/navigation';
import { queryKeys } from '@/lib/queryKeys';
import { StatsSummary } from './StatsSummary';
import { RankingSection } from './RankingSection';
import { PenaltySection } from './PenaltySection';
import { ContractDialog } from './ContractDialog';
import { formatSessionTime, getUnknownPenaltyCount } from './utils';
import type { ResultResponse } from './types';
import axios from 'axios';

/**
 * 세션 최종 결과 화면.
 * 전체 통계, 이탈 시간 순위, 멤버별 벌칙 결과, 각서 확인을 표시합니다.
 * 미공개 벌칙이 있으면 3초 폴링으로 자동 갱신하며,
 * 방이 아직 진행 중(403)이면 "진행 중" 안내 화면을 표시합니다.
 * 게스트 토큰은 페이지 이탈 시 삭제합니다 (refetch 401 방지).
 */
export function TotalResult() {
  // 결과 진입 경로를 페이지 로드 시 1회 읽어 고정 (이후 sessionStorage 변경에 영향받지 않음)
  const [closeTarget] = useState(getCloseTarget);
  // 룰렛에서 진입했는지 여부. 뒤로가기 방지(useBlockBrowserBack) 활성화에 사용
  const [isFromRoulette] = useState(() => getResultFrom() === 'room');
  useBlockBrowserBack({ redirectTo: '/', enabled: isFromRoulette });

  const router = useRouter();
  const params = useParams<{ code: string }>();
  const { me } = useAuth();
  const isSharingRef = useRef(false);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);

  const {
    data: result,
    isError,
    error,
    isLoading,
  } = useQuery({
    queryKey: queryKeys.result.detail(params.code),
    queryFn: async () => {
      const res = await getResultApi().resultControllerGetResult(params.code);
      return res.data as ResultResponse;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5_000,
    // 미공개 벌칙이 있는 멤버가 있으면 3초마다 폴링하여 룰렛 완료 시 자동 반영
    refetchInterval: (query) => {
      const data = query.state.data as ResultResponse | undefined;
      return data?.members.some((m) => getUnknownPenaltyCount(m) > 0)
        ? 3000
        : false;
    },
    // 403은 방이 아직 timer 페이즈인 경우 (중도포기자가 마이페이지에서 조기 접근)
    // 재시도 없이 즉시 "진행 중" 안내를 표시한다
    retry: (failureCount, err) => {
      if (axios.isAxiosError(err) && err.response?.status === 403) return false;
      return failureCount < 3;
    },
  });

  const rankedMembers = useMemo(
    () =>
      [...(result?.members ?? [])].sort(
        (a, b) => a.rank - b.rank || b.totalEscapeMs - a.totalEscapeMs,
      ),
    [result?.members],
  );
  const isLoggedInUser = me?.role === 'user';
  const totalTime = formatSessionTime(result?.totalSessionMs ?? null);
  const completedSessions = result?.rule
    ? `${result.completedRounds ?? 0} / ${result.rule.rounds}`
    : '-';

  const isRoomInProgress =
    isError && axios.isAxiosError(error) && error.response?.status === 403;

  /**
   * 결과 화면 닫기 핸들러.
   * 진입 경로 플래그 정리 → 게스트 토큰 삭제 → 진입 출처에 따라 라우팅.
   * 마이페이지 계열에서 왔으면 router.back(), 그 외는 router.push().
   */
  const handleClose = () => {
    clearResultFrom();
    if (isGuestAccessToken()) clearAccessTokenCookie();
    if (closeTarget === '/mypage' || closeTarget === '/mypage/history') {
      router.back();
    } else {
      router.push(closeTarget);
    }
  };

  /**
   * 결과 공유 핸들러.
   * 모바일이면 Web Share API, 데스크탑이면 클립보드 복사를 시도합니다.
   * 중복 호출 방지를 위해 isSharingRef로 가드합니다.
   */
  const handleShare = async () => {
    if (isSharingRef.current) return;
    isSharingRef.current = true;
    const shareUrl = window.location.href;
    const shareText = `${result?.roomTitle ?? '감옥'} 결과를 확인해보세요.\n${shareUrl}`;
    try {
      if (isMobileOrTablet() && navigator.share) {
        try {
          await navigator.share({ text: shareText });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success('방 주소가 복사되었어요.');
    } catch {
      toast.error('방 주소 복사에 실패했어요.');
    } finally {
      isSharingRef.current = false;
    }
  };

  return (
    <>
      <MobileLayout
        header={
          <>
            <HeaderTitle align='center'>수감 결과</HeaderTitle>
            <CloseButton onClick={handleClose} />
          </>
        }
        bottomButton={
          result ? (
            <div className='flex flex-col gap-2.5 bg-linear-to-t from-background from-65% to-transparent px-4 pt-8 pb-[calc(env(safe-area-inset-bottom)+12px)]'>
              <Button
                type='button'
                variant='secondary'
                onClick={() => setIsContractDialogOpen(true)}
                className='h-12 rounded-[14px] border border-white/10 bg-[#1A1F31] text-base font-bold text-white/85'
              >
                각서 확인하기
              </Button>
              <div className='grid grid-cols-2 gap-2.5'>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={handleShare}
                  className='h-12 rounded-[14px] border border-white/10 bg-[#1A1F31] text-base font-bold text-white/85'
                >
                  수감 결과 공유하기
                </Button>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={() =>
                    router.replace(isLoggedInUser ? '/mypage' : '/')
                  }
                  className='h-12 rounded-[14px] border border-white/10 bg-[#1A1F31] text-base font-bold text-white/85'
                >
                  {isLoggedInUser ? '마이페이지' : '홈으로 이동'}
                </Button>
              </div>
            </div>
          ) : undefined
        }
        bottomFloating
      >
        <div className='flex min-w-0 flex-col gap-4 text-foreground'>
          {isLoading && (
            <div className='py-10 text-center text-sm text-muted-foreground'>
              수감 결과 불러오는 중...
            </div>
          )}
          {isRoomInProgress && (
            <div className='flex flex-col items-center justify-center gap-3 py-20'>
              <p className='text-lg font-bold'>아직 방이 진행 중이에요</p>
              <p className='text-sm text-muted-foreground'>
                수감 시간이 종료되면 결과를 확인할 수 있어요
              </p>
              <Button
                onClick={handleClose}
                variant='secondary'
                className='mt-2'
              >
                돌아가기
              </Button>
            </div>
          )}
          {isError && !isRoomInProgress && !result && (
            <div className='py-10 text-center text-sm text-destructive'>
              수감 결과를 불러오지 못했어요.
            </div>
          )}
          {result && (
            <>
              <section className='flex flex-col items-center px-4 py-5 text-center'>
                <div className='mb-2 flex h-9 w-9 items-center justify-center rounded-full text-primary'>
                  <Trophy className='h-5 w-5 text-[#FBBF24]' />
                </div>
                <h2 className='text-xl font-bold text-[#FBBF24]'>
                  모두 고생했어요!
                </h2>
                <p className='mt-2 text-sm font-medium text-foreground/80'>
                  약속한 수감 시간을 완료했어요.
                </p>
              </section>
              <StatsSummary
                totalTime={totalTime}
                completedSessions={completedSessions}
                penaltyMemberCount={result.penaltyMemberCount ?? 0}
              />
              <RankingSection members={rankedMembers} me={me} showEscapeTime />
              <PenaltySection members={rankedMembers} me={me} />
            </>
          )}
        </div>
      </MobileLayout>
      <ContractDialog
        open={isContractDialogOpen}
        onOpenChange={setIsContractDialogOpen}
        roomTitle={result?.roomTitle ?? params.code}
        rule={result?.rule ?? null}
      />
    </>
  );
}
