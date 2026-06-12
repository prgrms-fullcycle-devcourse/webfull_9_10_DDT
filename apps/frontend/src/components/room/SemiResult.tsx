'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ThumbsUp } from 'lucide-react';
import { getResultApi } from '@/api/generated/result-api-결과-조회/result-api-결과-조회';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { getProfileImageSrc } from '@/lib/profileImage';
import { useAuth } from '@/hooks/useAuth';
import { useBlockBrowserBack } from '@/hooks/useBlockBrowserBack';
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
      sessionStorage.setItem('totalResultFrom', 'room');
      router.replace(`/room/${params.code}/total-result`);
    }
  }, [isNoDisruption, params.code, router]);

  if (isNoDisruption) return null;

  const HeaderComponent = (
    <HeaderTitle align='center'>결과</HeaderTitle>
  );

  const BottomButtonComponent = (
    <Button
      onClick={() => {
        if (!shouldShowRoulette) {
          sessionStorage.setItem('totalResultFrom', 'room');
        }
        router.push(
          shouldShowRoulette
            ? `/room/${params.code}/roulette`
            : `/room/${params.code}/total-result`,
        );
      }}
      disabled={isLoading || isError || !canDecideNextRoute}
      className='w-full h-12 rounded-[14px] text-base font-bold'
    >
      {!canDecideNextRoute
        ? '확인 중...'
        : shouldShowRoulette
          ? '룰렛 돌리기'
          : '다음'}
    </Button>
  );

  return (
    <MobileLayout
      header={HeaderComponent}
      bottomButton={BottomButtonComponent}
    >
      <div className='flex min-w-0 flex-col gap-4 text-foreground'>
          {isLoading ? (
            <div className='py-10 text-center text-sm text-muted-foreground'>
              결과를 불러오는 중...
            </div>
          ) : null}
          {isError ? (
            <div className='py-10 text-center text-sm text-destructive'>
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
                    <p className='mt-2 text-sm font-medium text-foreground/80'>
                      오늘 집중력은 최고네요.
                    </p>
                  </>
                ) : (
                  <>
                    <div className='mb-1 text-3xl animate-pulse'>🎉</div>
                    <h2 className='text-xl font-bold tracking-tight text-[#10B981]'>
                      집중시간이 종료되었습니다.
                    </h2>
                    <p className='mt-2 text-sm font-medium text-foreground/80'>
                      결과를 확인해 주세요.
                    </p>
                  </>
                )}
              </div>

              <section className='grid grid-cols-3 overflow-hidden rounded-[14px] bg-[#1d1c31] text-center text-[11px] text-white/50'>
                <div className='flex min-w-0 flex-col items-center gap-1 border-r border-white/10 px-2.5 py-3'>
                  <span>총 진행 시간</span>
                  <strong className='text-base text-white/85'>
                    {totalTime}
                  </strong>
                </div>
                <div className='flex min-w-0 flex-col items-center gap-1 border-r border-white/10 px-2.5 py-3'>
                  <span>완료한 반복</span>
                  <strong className='text-base text-white/85'>
                    {completedSessions}
                  </strong>
                </div>
                <div className='flex min-w-0 flex-col items-center gap-1 px-2.5 py-3'>
                  <span>벌칙 수행자</span>
                  <strong className='text-base text-white/85'>
                    {isNoDisruption ? '0명' : `${result.penaltyMemberCount}명`}
                  </strong>
                </div>
              </section>

              <section className='flex flex-col gap-2'>
                <h3 className='px-1 text-xs font-semibold text-muted-foreground'>
                  {isNoDisruption ? '참여 멤버' : '이탈 시간 순위'}
                </h3>

                <div className='overflow-hidden rounded-2xl bg-[#1d1c31]'>
                  {rankedMembers.map((member) => {
                    const isMe = me
                      ? (me.role === 'user' && member.userId === me.id) ||
                        (me.role === 'guest' && member.guestToken === me.id)
                      : false;
                    const profileImageSrc = getProfileImageSrc(
                      member.profileImage,
                    );

                    return (
                      <div
                        key={member.memberId}
                        className='flex items-center justify-between border-b border-slate-800/50 px-4 py-3 last:border-b-0'
                      >
                        <div className='flex min-w-0 items-center gap-3'>
                          {member.isAllClear || isNoDisruption ? (
                            <ThumbsUp className='h-4 w-7 shrink-0 text-[#FBBF24]' />
                          ) : (
                            <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-xs font-bold text-destructive'>
                              {member.rank}
                            </div>
                          )}

                          <Avatar className='h-9 w-9 border border-slate-700 bg-[#22293F]'>
                            {profileImageSrc ? (
                              <AvatarImage
                                src={profileImageSrc}
                                alt={`${member.nickname} 프로필 이미지`}
                              />
                            ) : null}
                            <AvatarFallback className='bg-transparent text-xs text-slate-300'>
                              {member.nickname.slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>

                          <div className='min-w-0'>
                            <div className='flex min-w-0 items-center gap-1.5'>
                              <span
                                className={`truncate text-sm font-semibold ${
                                  member.gaveUpAt
                                    ? 'text-destructive'
                                    : 'text-slate-100'
                                }`}
                              >
                                {member.nickname}
                                {member.isHost && ' (방장)'}
                                {isMe && ' (나)'}
                              </span>

                              {member.gaveUpAt && !isNoDisruption ? (
                                <Badge className='h-5 shrink-0 border-none bg-destructive px-1.5 text-[10px] font-bold text-white hover:bg-destructive'>
                                  중도 포기
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <span className='shrink-0 text-xs font-medium text-slate-400'>
                          {!isNoDisruption && member.penalties.totalCount > 0
                            ? `벌칙 ${member.penalties.totalCount}개`
                            : '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          ) : null}
        </div>
    </MobileLayout>
  );
}
