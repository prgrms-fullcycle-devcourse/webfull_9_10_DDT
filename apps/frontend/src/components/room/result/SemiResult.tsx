'use client';
import { useMemo } from 'react';
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

/**
 * 세션 종료 직후 표시되는 중간 결과 화면.
 * 총 수감 시간, 완료한 반복 횟수, 벌칙 대상자 수와 이탈 순위를 보여줍니다.
 * 이탈자가 0명이면 축하 메시지를, 아니면 순위표를 표시합니다.
 * 벌칙 룰렛이 필요한 멤버는 룰렛 페이지로, 아니면 최종 결과 페이지로 이동합니다.
 */
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
  // '전체 축하' 분기는 '이탈 0명 AND 벌칙 0명'일 때만. 둘 중 하나라도 있으면 순위/벌칙을 표시한다.
  const isNoDisruption =
    !!result && result.allClear && (result.penaltyMemberCount ?? 0) === 0;
  const totalTime = formatSessionTime(result?.totalSessionMs ?? null);
  const completedSessions = result?.rule
    ? `${result.completedRounds ?? 0} / ${result.rule.rounds}`
    : '-';

  /**
   * "다음" 버튼 핸들러.
   * 룰렛이 필요하면 룰렛 페이지로, 아니면 TotalResult로 이동합니다.
   * 룰렛이 불필요한 경우에만 결과 진입 경로를 저장합니다 (뒤로가기 목적지 결정용).
   */
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
              ? '벌칙 룰렛 돌리기'
              : '다음'}
        </Button>
      }
    >
      <div className='flex min-w-0 flex-col gap-4 text-foreground'>
        {isLoading && (
          <div className='py-10 text-center text-sm text-muted-foreground'>
            수감 결과를 불러오는 중...
          </div>
        )}
        {isError && (
          <div className='py-10 text-center text-sm text-destructive'>
            수감 결과를 불러오지 못했어요.
          </div>
        )}
        {result && (
          <>
            <div className='space-y-1.5 py-4 text-center'>
              {isNoDisruption ? (
                <>
                  <div className='mb-1 text-3xl animate-bounce'>👍</div>
                  <h2 className='text-xl font-bold tracking-tight text-[#FBBF24]'>
                    탈옥한 수감자가 아무도 없어요!
                  </h2>
                  <p className='mt-2 text-sm font-medium text-foreground/80'>
                    오늘 집중력은 최고네요.
                  </p>
                </>
              ) : (
                <>
                  <div className='mb-1 text-3xl animate-pulse'>🎉</div>
                  <h2 className='text-xl font-bold tracking-tight text-[#10B981]'>
                    수감 시간이 종료되었어요.
                  </h2>
                  <p className='mt-2 text-sm font-medium text-foreground/80'>
                    수감 결과를 확인해주세요.
                  </p>
                </>
              )}
            </div>
            <StatsSummary
              totalTime={totalTime}
              completedSessions={completedSessions}
              penaltyMemberCount={result.penaltyMemberCount ?? 0}
            />
            <RankingSection
              members={rankedMembers}
              me={me}
              isNoDisruption={isNoDisruption}
              showEscapeTime={false}
            />
          </>
        )}
      </div>
    </MobileLayout>
  );
}
