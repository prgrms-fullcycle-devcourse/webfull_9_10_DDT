'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ThumbsUp } from 'lucide-react';
import { getResultApi } from '@/api/generated/result-api-결과-조회/result-api-결과-조회';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/queryKeys';

type ResultMember = {
  memberId: string;
  userId: string | null;
  guestToken: string | null;
  nickname: string;
  profileImage: string | null;
  isHost: boolean;
  rank: number;
  totalEscapeMs: number;
  penaltyTier: number;
  isAllClear: boolean;
  penaltyCount: number;
  remainingSpins: number;
  gaveUpAt: string | null;
  penalties: {
    totalCount: number;
    items: { content: string; count: number }[];
  };
};

type ResultResponse = {
  totalSessionMs: number | null;
  completedRounds: number | null;
  penaltyMemberCount: number;
  allClear: boolean;
  members: ResultMember[];
  rule: {
    rounds: number;
  } | null;
};

const formatSessionTime = (totalMs: number | null) => {
  if (totalMs === null) return '-';

  const totalMinutes = Math.floor(totalMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}분`;
  if (minutes <= 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
};

export function SemiResult() {
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

  // 룰렛 스킵 판정은 이탈(allClear)이 아니라 벌칙 대상자 유무 기준.
  // ⚠️ !!result 로딩가드 필수: 없으면 result===undefined일 때
  //    (undefined ?? 0)===0 이 true가 되어 데이터 도착 전 total-result로 조기 리다이렉트됨.
  const isNoDisruption = !!result && (result.penaltyMemberCount ?? 0) === 0;
  const rankedMembers = [...(result?.members ?? [])].sort(
    (a, b) => a.rank - b.rank || b.totalEscapeMs - a.totalEscapeMs,
  );
  const myResult = me
    ? rankedMembers.find((member) =>
        me.role === 'user'
          ? member.userId === me.id
          : member.guestToken === me.id,
      )
    : null;
  const shouldShowRoulette = (myResult?.remainingSpins ?? 0) > 0;
  const canDecideNextRoute = !!result && !!me && !!myResult;
  const totalTime = formatSessionTime(result?.totalSessionMs ?? null);
  const completedSessions = result?.rule
    ? `${result.completedRounds ?? 0} / ${result.rule.rounds}`
    : '-';

  useEffect(() => {
    if (isNoDisruption) {
      router.replace(`/room/${params.code}/total-result`);
    }
  }, [isNoDisruption, params.code, router]);

  if (isNoDisruption) return null;

  const HeaderComponent = (
    <div className='w-full py-2 text-center'>
      <h1 className='text-base font-medium tracking-tight text-white'>결과</h1>
    </div>
  );

  const BottomButtonComponent = (
    <Button
      onClick={() =>
        router.push(
          shouldShowRoulette
            ? `/room/${params.code}/roulette`
            : `/room/${params.code}/total-result`,
        )
      }
      disabled={isLoading || isError || !canDecideNextRoute}
      className='w-full rounded-xl border-none bg-[#7C3AED] py-6 text-base font-bold text-white shadow-lg transition-colors hover:bg-[#6D28D9]'
    >
      {!canDecideNextRoute
        ? '확인 중...'
        : shouldShowRoulette
          ? '룰렛 돌리기'
          : '다음'}
    </Button>
  );

  return (
    <div className='min-h-screen bg-[#0F111A] font-sans text-slate-100 antialiased'>
      <MobileLayout
        header={HeaderComponent}
        bottomButton={BottomButtonComponent}
      >
        <div className='flex w-full flex-col items-center space-y-6 px-1 pb-8 pt-4'>
          {isLoading ? (
            <div className='py-10 text-sm text-slate-400'>
              결과를 불러오는 중...
            </div>
          ) : null}
          {isError ? (
            <div className='py-10 text-sm text-[#F85A5A]'>
              결과를 불러오지 못했습니다.
            </div>
          ) : null}
          {result ? (
            <>
              <div className='space-y-1.5 py-4 text-center'>
                {isNoDisruption ? (
                  <>
                    <div className='mb-1 text-3xl animate-bounce'>👍</div>
                    <h2 className='text-xl font-bold tracking-tight text-[#FBBF24]'>
                      이탈 유저가 아무도 없어요!
                    </h2>
                    <p className='text-xs font-medium text-slate-400'>
                      오늘 집중력은 최고네요.
                    </p>
                  </>
                ) : (
                  <>
                    <div className='mb-1 text-3xl animate-pulse'>🎉</div>
                    <h2 className='text-xl font-bold tracking-tight text-[#10B981]'>
                      집중시간이 종료되었습니다.
                    </h2>
                    <p className='text-xs font-medium text-slate-400'>
                      결과를 확인해 주세요.
                    </p>
                  </>
                )}
              </div>

              <div className='grid w-full grid-cols-3 items-center divide-x divide-slate-800 rounded-2xl border border-slate-800/60 bg-[#1A1F31] p-4 text-center'>
                <div className='space-y-1.5'>
                  <p className='text-[10px] font-medium text-slate-400'>
                    총 진행 시간
                  </p>
                  <p className='text-sm font-bold text-slate-200'>
                    {totalTime}
                  </p>
                </div>
                <div className='space-y-1.5'>
                  <p className='text-[10px] font-medium text-slate-400'>
                    완료한 반복
                  </p>
                  <p className='text-sm font-bold text-slate-200'>
                    {completedSessions}
                  </p>
                </div>
                <div className='space-y-1.5'>
                  <p className='text-[10px] font-medium text-slate-400'>
                    벌칙 수행자
                  </p>
                  <p className='text-sm font-bold text-slate-200'>
                    {isNoDisruption ? '0명' : `${result.penaltyMemberCount}명`}
                  </p>
                </div>
              </div>

              <div className='w-full pl-1 text-left'>
                <p className='text-xs font-semibold tracking-wider text-slate-400'>
                  {isNoDisruption ? '참여 멤버' : '이탈 시간 순위'}
                </p>
              </div>

              <div className='w-full divide-y divide-slate-800/40 overflow-hidden rounded-2xl border border-slate-900 bg-[#151926]'>
                {rankedMembers.map((member) => {
                  const isTopRank = member.rank <= 3;
                  const isMe = me?.role === 'user' && member.userId === me.id;

                  let rankColor = 'text-slate-500';
                  if (isTopRank && !isNoDisruption) {
                    if (member.rank === 1)
                      rankColor = 'font-bold text-[#F85A5A]';
                    else if (member.rank === 2) {
                      rankColor = 'font-bold text-[#F59E0B]';
                    } else if (member.rank === 3) {
                      rankColor = 'font-bold text-[#FBBF24]';
                    }
                  }

                  return (
                    <div
                      key={member.memberId}
                      className='flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-slate-800/20'
                    >
                      <div className='flex items-center gap-3.5'>
                        {member.isAllClear || isNoDisruption ? (
                          <ThumbsUp className='h-4 w-4 flex-shrink-0 fill-[#FBBF24]/20 text-[#FBBF24]' />
                        ) : (
                          <span
                            className={`w-4 text-center text-xs ${rankColor}`}
                          >
                            {member.rank}
                          </span>
                        )}

                        <Avatar className='h-8 w-8 border border-slate-800 bg-[#22293F]'>
                          <AvatarFallback className='bg-transparent text-xs text-slate-300'>
                            {member.nickname.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>

                        <div className='flex items-center gap-1.5'>
                          <span
                            className={`text-xs font-semibold tracking-tight ${
                              member.gaveUpAt
                                ? 'text-[#F85A5A]'
                                : 'text-slate-200'
                            }`}
                          >
                            {member.nickname}
                            {member.isHost && ' (방장)'}
                            {isMe && ' (나)'}
                          </span>

                          {member.gaveUpAt && !isNoDisruption ? (
                            <Badge className='h-4 rounded-full border-none bg-[#F85A5A] px-1.5 py-0 text-[9px] font-bold text-white hover:bg-[#F85A5A]'>
                              중도 포기
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className='text-right'>
                        <span className='text-xs font-medium text-slate-400'>
                          {!isNoDisruption && member.penalties.totalCount > 0
                            ? `벌칙 ${member.penalties.totalCount}개`
                            : '-'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </MobileLayout>
    </div>
  );
}
