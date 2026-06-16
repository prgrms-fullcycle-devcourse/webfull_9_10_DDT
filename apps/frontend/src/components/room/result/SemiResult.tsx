'use client';
import { useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { useAuth } from '@/hooks/useAuth';
import { useBlockBrowserBack } from '@/hooks/useBlockBrowserBack';
import { isMeMember } from '@/lib/member';
import { setResultFrom } from '@/lib/navigation';
import { queryKeys } from '@/lib/queryKeys';
import { getResultApi } from '@/api/generated/result-api-결과-조회/result-api-결과-조회';
import { StatsSummary } from './StatsSummary';
import { RankingSection } from './RankingSection';
import { formatSessionTime } from './utils';
import type { ResultResponse } from './types';

export function SemiResult() {
  useBlockBrowserBack();

  const router = useRouter();
  const params = useParams<{ code: string }>();
  const { me } = useAuth();

  const {
    data: result,
    isError,
    isLoading,
  } = useQuery({
    queryKey: queryKeys.result.detail(params.code),
    queryFn: async () => {
      const res = await getResultApi().resultControllerGetResult(params.code);
      return res.data as ResultResponse;
    },
  });

  const rankedMembers = useMemo(
    () =>
      [...(result?.members ?? [])].sort(
        (a, b) => a.rank - b.rank || b.totalEscapeMs - a.totalEscapeMs,
      ),
    [result?.members],
  );
  const myResult = me ? rankedMembers.find((m) => isMeMember(me, m)) : null;
  const shouldShowRoulette = (myResult?.remainingSpins ?? 0) > 0;
  const canDecideNextRoute = !!result && !!me && !!myResult;
  const isNoDisruption = !!result && (result.penaltyMemberCount ?? 0) === 0;
  const isSolo = rankedMembers.length <= 1;
  const totalTime = formatSessionTime(result?.totalSessionMs ?? null);
  const completedSessions = result?.rule
    ? `${result.completedRounds ?? 0} / ${result.rule.rounds}`
    : '-';

  useEffect(() => {
    if (isNoDisruption) {
      setResultFrom('room');
      router.replace(`/room/${params.code}/total-result`);
    }
  }, [isNoDisruption, params.code, router]);

  if (isNoDisruption) return null;

  const handleNext = () => {
    if (!shouldShowRoulette) setResultFrom('room');
    router.push(
      shouldShowRoulette
        ? `/room/${params.code}/roulette`
        : `/room/${params.code}/total-result`,
    );
  };

  return (
    <MobileLayout
      header={<HeaderTitle align='center'>결과</HeaderTitle>}
      bottomButton={
        <Button
          onClick={handleNext}
          disabled={isLoading || isError || !canDecideNextRoute}
          className='w-full h-12 rounded-[14px] text-base font-bold'
        >
          {!canDecideNextRoute
            ? '확인 중...'
            : shouldShowRoulette
              ? '룰렛 돌리기'
              : '다음'}
        </Button>
      }
    >
      <div className='flex min-w-0 flex-col gap-4 text-foreground'>
        {isLoading && (
          <div className='py-10 text-center text-sm text-muted-foreground'>
            결과를 불러오는 중...
          </div>
        )}
        {isError && (
          <div className='py-10 text-center text-sm text-destructive'>
            결과를 불러오지 못했습니다.
          </div>
        )}
        {result && (
          <>
            <div className='space-y-1.5 py-4 text-center'>
              <div className='mb-1 text-3xl animate-pulse'>🎉</div>
              <h2 className='text-xl font-bold tracking-tight text-[#10B981]'>
                집중시간이 종료되었습니다.
              </h2>
              <p className='mt-2 text-sm font-medium text-foreground/80'>
                결과를 확인해 주세요.
              </p>
            </div>
            <StatsSummary
              totalTime={totalTime}
              completedSessions={completedSessions}
              penaltyMemberCount={result.penaltyMemberCount ?? 0}
            />
            <RankingSection
              members={rankedMembers}
              me={me}
              isSolo={isSolo}
              isNoDisruption={isNoDisruption}
              showEscapeTime={false}
            />
          </>
        )}
      </div>
    </MobileLayout>
  );
}
