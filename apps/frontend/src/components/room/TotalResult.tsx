'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { jwtDecode } from 'jwt-decode';
import { Award, ChevronDown, ThumbsUp, Trophy } from 'lucide-react';
import { getResultApi } from '@/api/generated/result-api-결과-조회/result-api-결과-조회';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { useAuthStore } from '@/store/useAuthStore';
import { getToken } from '@/lib/getToken';

type ResultPenaltyItem = {
  content: string;
  count: number;
};

type ResultMember = {
  memberId: string;
  userId: string | null;
  nickname: string;
  profileImage: string | null;
  isHost: boolean;
  rank: number;
  totalEscapeMs: number;
  penaltyTier: number;
  isAllClear: boolean;
  penaltyCount: number;
  gaveUpAt: string | null;
  penalties: {
    totalCount: number;
    items: ResultPenaltyItem[];
  };
};

type ResultRule = {
  focusMin: number;
  breakMin: number;
  rounds: number;
  penalties: { itemId: string; content: string }[];
  tierConfig: {
    tiers?: {
      tier: number;
      minPct: number;
      maxPct: number | null;
      count: number;
    }[];
  };
};

type ResultResponse = {
  roomTitle: string;
  totalSessionMs: number | null;
  completedRounds: number | null;
  penaltyMemberCount: number;
  allClear: boolean;
  members: ResultMember[];
  rule: ResultRule | null;
};

type JwtPayload = {
  role?: string;
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

const formatTierRange = (minPct: number, maxPct: number | null) =>
  maxPct === null ? `${minPct}% ~` : `${minPct} ~ ${maxPct}%`;

const clearAccessTokenCookie = () => {
  document.cookie =
    'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
};

const isGuestToken = () => {
  const token = getToken();
  if (!token) return false;

  try {
    return jwtDecode<JwtPayload>(token).role === 'guest';
  } catch {
    return false;
  }
};

const getUnknownPenaltyCount = (member: ResultMember) =>
  Math.max(0, member.penalties.totalCount - member.penaltyCount);

const isMobileOrTablet = () => {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent.toLowerCase();
  const hasTouchScreen =
    navigator.maxTouchPoints > 1 &&
    /macintosh/.test(userAgent);

  return /android|iphone|ipad|ipod|mobile|tablet/.test(userAgent) || hasTouchScreen;
};

export function TotalResult() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const { me, fetchMe } = useAuthStore();
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [selectedPenaltyMember, setSelectedPenaltyMember] =
    useState<ResultMember | null>(null);

  useEffect(() => {
    if (!me) void fetchMe();
  }, [fetchMe, me]);

  const {
    data: result,
    isError,
    isLoading,
  } = useQuery({
    queryKey: ['result', params.code],
    queryFn: async () => {
      const res = await getResultApi().resultControllerGetResult(params.code);
      return res.data as ResultResponse;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5 * 1000,
    refetchInterval: (query) => {
      const data = query.state.data as ResultResponse | undefined;
      const hasUnknownPenalties = data?.members.some(
        (member) => getUnknownPenaltyCount(member) > 0,
      );

      return hasUnknownPenalties ? 3000 : false;
    },
  });

  useEffect(() => {
    if (!result) return;

    if (isGuestToken()) clearAccessTokenCookie();
  }, [result]);

  const rankedMembers = [...(result?.members ?? [])].sort(
    (a, b) => a.rank - b.rank || b.totalEscapeMs - a.totalEscapeMs,
  );
  const penaltyMembers = rankedMembers.filter(
    (member) => member.penalties.totalCount > 0,
  );
  const activePenaltyMember = selectedPenaltyMember
    ? rankedMembers.find(
        (member) => member.memberId === selectedPenaltyMember.memberId,
      ) ?? selectedPenaltyMember
    : null;
  const tiers = result?.rule?.tierConfig?.tiers ?? [];
  const totalTime = formatSessionTime(result?.totalSessionMs ?? null);
  const completedSessions = result?.rule
    ? `${result.completedRounds ?? 0} / ${result.rule.rounds}`
    : '-';
  const isLoggedInUser = me?.role === 'user';

  const handleShare = async () => {
    const shareUrl = window.location.href;

    if (isMobileOrTablet() && navigator.share) {
      try {
        await navigator.share({
        title: 'DDT 통합 결과',
          text: `${result?.roomTitle ?? 'DDT'} 결과를 확인해보세요.`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('URL이 복사되었어요.');
    } catch {
      toast.error('URL 복사에 실패했습니다.');
    }
  };

  const HeaderComponent = (
    <div className='relative flex w-full items-center justify-center text-foreground'>
      <h1 className='text-base font-medium tracking-tight'>통합 결과</h1>
    </div>
  );

  return (
    <>
      <MobileLayout header={HeaderComponent}>
        <div className='flex min-w-0 flex-col gap-4 pb-[150px] text-foreground'>
          {isLoading ? (
            <div className='py-10 text-center text-sm text-muted-foreground'>
              통합 결과를 불러오는 중...
            </div>
          ) : null}
          {isError && !result ? (
            <div className='py-10 text-center text-sm text-destructive'>
              통합 결과를 불러오지 못했습니다.
            </div>
          ) : null}
          {result ? (
            <>
          <section className='flex flex-col items-center px-4 py-5 text-center'>
            <div className='mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary'>
              <Trophy className='h-5 w-5' />
            </div>
            <h2 className='text-xl font-bold text-[#FBBF24]'>
              모두 고생했어요!
            </h2>
            <p className='mt-2 text-sm font-medium text-foreground/80'>
              약속한 집중 시간을 완료했어요.
            </p>
          </section>

          <section className='grid grid-cols-3 overflow-hidden rounded-[14px] bg-[#1A1F31] text-center text-[11px] text-white/50'>
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
                {result.allClear ? '0명' : `${result.penaltyMemberCount}명`}
              </strong>
            </div>
          </section>

          <section className='flex flex-col gap-2'>
            <h3 className='px-1 text-xs font-semibold text-muted-foreground'>
              이탈 시간 순위
            </h3>
            <div className='overflow-hidden rounded-2xl border border-slate-800/70 bg-[#151926]'>
              {rankedMembers.map((member) => {
                const isMe = me?.role === 'user' && member.userId === me.id;

                return (
                  <div
                    key={member.memberId}
                    className='flex items-center justify-between border-b border-slate-800/50 px-4 py-3 last:border-b-0'
                  >
                    <div className='flex min-w-0 items-center gap-3'>
                      {member.isAllClear ? (
                        <ThumbsUp className='h-4 w-7 shrink-0 text-[#FBBF24]' />
                      ) : (
                        <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F85A5A]/15 text-xs font-bold text-[#F85A5A]'>
                          {member.rank}
                        </div>
                      )}
                      <Avatar className='h-9 w-9 border border-slate-700 bg-[#22293F]'>
                        <AvatarFallback className='bg-transparent text-xs text-slate-300'>
                          {member.nickname.slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <div className='min-w-0'>
                        <div className='flex min-w-0 items-center gap-1.5'>
                          <span className='truncate text-sm font-semibold text-slate-100'>
                            {member.nickname}
                            {member.isHost ? ' (방장)' : ''}
                            {isMe ? ' (나)' : ''}
                          </span>
                          {member.gaveUpAt ? (
                            <Badge className='h-5 shrink-0 border-none bg-[#F85A5A] px-1.5 text-[10px] font-bold text-white hover:bg-[#F85A5A]'>
                              중도 포기
                            </Badge>
                          ) : null}
                        </div>
                        <p className='mt-0.5 text-xs text-slate-500'>
                          {member.isAllClear ? '이탈 없음' : `${member.rank}위`}
                        </p>
                      </div>
                    </div>
                    <span className='shrink-0 text-xs font-medium text-slate-400'>
                      {member.totalEscapeMs > 0
                        ? formatSessionTime(member.totalEscapeMs)
                        : '이탈 없음'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className='flex flex-col gap-2'>
            <h3 className='px-1 text-xs font-semibold text-muted-foreground'>
              멤버별 벌칙 결과
            </h3>
            <div className='flex flex-col gap-2'>
              {penaltyMembers.length > 0 ? (
                penaltyMembers.map((member) => {
                  const isMe = me?.role === 'user' && member.userId === me.id;
                  const unknownPenaltyCount = getUnknownPenaltyCount(member);

                  return (
                  <div
                    key={member.memberId}
                    className='flex min-w-0 items-center justify-between rounded-xl border border-slate-800/70 bg-[#151926] px-4 py-3'
                  >
                    <div className='flex min-w-0 items-center gap-3'>
                      <Award className='h-4 w-4 shrink-0 text-[#FBBF24]' />
                      <span className='truncate text-sm font-semibold text-slate-100'>
                        {member.nickname}
                        {isMe ? ' (나)' : ''}
                      </span>
                    </div>
                    <button
                      type='button'
                      onClick={() => setSelectedPenaltyMember(member)}
                      className='flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-sm font-bold text-white/85 transition-colors hover:bg-white/5'
                      aria-label={`${member.nickname} 벌칙 상세 보기`}
                    >
                      벌칙 {member.penalties.totalCount}개
                      {unknownPenaltyCount > 0
                        ? ` (룰렛 대기중 ${unknownPenaltyCount})`
                        : ''}
                      <ChevronDown className='h-4 w-4 text-white/35' />
                    </button>
                  </div>
                  );
                })
              ) : (
                <div className='flex items-center gap-3 rounded-xl border border-slate-800/70 bg-[#151926] px-4 py-4 text-sm text-slate-300'>
                  <ThumbsUp className='h-4 w-4 text-[#FBBF24]' />
                  벌칙 결과가 없어요.
                </div>
              )}
            </div>
          </section>
            </>
          ) : null}
        </div>
      </MobileLayout>

      <div className='fixed bottom-0 left-1/2 z-50 w-full max-w-[390px] -translate-x-1/2 border-t border-white/10 bg-[#0F111A] px-[18px] pb-5 pt-3'>
        <div className='flex flex-col gap-2.5'>
          <Button
            type='button'
            onClick={() => setIsContractDialogOpen(true)}
            className='h-[54px] w-full rounded-[14px] bg-primary text-sm font-bold text-primary-foreground'
          >
            계약서 보기
          </Button>
          <div className='grid grid-cols-2 gap-2.5'>
            <Button
              type='button'
              variant='secondary'
              onClick={handleShare}
              className='h-12 rounded-[14px] border border-white/10 bg-[#1A1F31] text-sm font-bold text-white/85'
            >
              공유하기
            </Button>
            <Button
              type='button'
              variant='secondary'
              onClick={() => router.push(isLoggedInUser ? '/mypage' : '/')}
              className='h-12 rounded-[14px] border border-white/10 bg-[#1A1F31] text-sm font-bold text-white/85'
            >
              {isLoggedInUser ? '마이페이지' : '홈 화면으로 이동'}
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={!!selectedPenaltyMember}
        onOpenChange={(open) => !open && setSelectedPenaltyMember(null)}
      >
        <DialogContent className='w-[calc(100%-36px)] max-w-[354px] overflow-hidden rounded-xl border border-white/10 bg-[#1A1F31] p-0 text-left text-white/85'>
          {activePenaltyMember ? (
            <>
              <div className='px-4 pb-3 pt-4'>
                <DialogTitle className='text-base font-bold text-white/90'>
                  {activePenaltyMember.nickname}
                  {me?.role === 'user' &&
                  activePenaltyMember.userId === me.id
                    ? ' (본인)'
                    : ''}
                </DialogTitle>
              </div>

              <div className='flex flex-col'>
                {activePenaltyMember.penalties.items.map(
                  (penalty, index) => (
                    <div
                      key={`${activePenaltyMember.memberId}-${penalty.content}-${index}`}
                      className='flex items-center gap-[9.7px] border-t border-white/5 px-4 py-[9px]'
                    >
                      <div className='h-9 w-9 shrink-0 rounded-[18px] bg-[#22293F]' />
                      <div className='flex min-w-0 flex-1 flex-col'>
                        <span className='truncate text-sm font-medium text-white/85'>
                          {penalty.content}
                        </span>
                      </div>
                      <span className='shrink-0 text-xs text-white/75'>
                        {penalty.count}개
                      </span>
                    </div>
                  ),
                )}
                {getUnknownPenaltyCount(activePenaltyMember) > 0 ? (
                  <div className='flex items-center gap-[9.7px] border-t border-white/5 px-4 py-[9px]'>
                    <div className='h-9 w-9 shrink-0 rounded-[18px] bg-[#22293F]' />
                    <div className='flex min-w-0 flex-1 flex-col'>
                      <span className='truncate text-sm font-medium text-white/50'>
                        룰렛 대기중
                      </span>
                    </div>
                    <span className='shrink-0 text-xs text-white/75'>
                      {getUnknownPenaltyCount(activePenaltyMember)}개
                    </span>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
        <DialogContent className='max-h-[82vh] w-[calc(100%-36px)] max-w-[354px] overflow-y-auto rounded-[18px] border border-white/10 bg-[#0f0d1a] p-[18px] text-left text-white/85'>
          <div className='flex flex-col gap-4'>
            <div className='flex items-center'>
              <div className='flex h-9 min-w-0 items-center gap-0.5 pr-5'>
                <div className='h-9 w-9 shrink-0 rounded-[18px] bg-[#22293F]' />
                <DialogTitle className='truncate text-base font-medium text-white/85'>
                  {result?.roomTitle ?? params.code}의 계약서
                </DialogTitle>
              </div>
            </div>

            <section className='flex flex-col gap-3'>
              <h3 className='text-sm font-medium text-white/45'>타이머</h3>
              <div className='grid grid-cols-3 overflow-hidden rounded-[14px] bg-[#1A1F31] text-center text-[11px] text-white/40'>
                <div className='flex h-[61px] flex-col items-center justify-center gap-1 border-r border-white/10 px-[9px]'>
                  <span>집중 시간</span>
                  <strong className='text-base text-white/85'>
                    {result?.rule?.focusMin ?? '-'}분
                  </strong>
                </div>
                <div className='flex h-[61px] flex-col items-center justify-center gap-1 border-r border-white/10 px-2.5'>
                  <span>휴식 시간</span>
                  <strong className='text-base text-white/85'>
                    {result?.rule?.breakMin ?? '-'}분
                  </strong>
                </div>
                <div className='flex h-[61px] flex-col items-center justify-center gap-1 px-2.5'>
                  <span>반복 횟수</span>
                  <strong className='text-base text-white/85'>
                    {result?.rule?.rounds ?? '-'}회
                  </strong>
                </div>
              </div>
            </section>

            <section className='flex flex-col gap-3'>
              <h3 className='text-sm font-medium text-white/45'>벌칙 목록</h3>
              <div className='overflow-hidden rounded-[14px] bg-[#1A1F31] text-sm font-medium text-white/85'>
                {(result?.rule?.penalties ?? []).map((penalty, index) => (
                  <div
                    key={penalty.itemId}
                    className={`flex min-h-[46px] items-center px-4 py-3.5 ${
                      index > 0 ? 'border-t border-white/5' : ''
                    }`}
                  >
                    {penalty.content}
                  </div>
                ))}
                {result?.rule?.penalties.length === 0 ? (
                  <div className='flex min-h-[46px] items-center px-4 py-3.5 text-white/50'>
                    벌칙 목록이 없습니다.
                  </div>
                ) : null}
              </div>
            </section>

            <section className='flex flex-col gap-3'>
              <h3 className='text-sm font-medium text-white/45'>벌칙 강도</h3>
              <div className='overflow-hidden rounded-[14px] bg-[#1A1F31] text-sm font-medium text-white/85'>
                {tiers.map((tier, index) => (
                  <div
                    key={`${tier.tier}-${tier.minPct}-${tier.maxPct}`}
                    className={`flex items-center gap-2 px-4 py-3.5 ${
                      index > 0 ? 'border-t border-white/5' : ''
                    }`}
                  >
                    <div className='flex min-w-0 flex-1 items-center gap-[5px]'>
                      <span className='flex h-[22px] w-[42.6px] shrink-0 items-center justify-center rounded-[20px] bg-[rgba(124,77,255,0.15)] text-[11px] font-bold leading-[120%] text-[#7c4dff]'>
                        {tier.tier}단계
                      </span>
                      <span className='truncate'>
                        {formatTierRange(tier.minPct, tier.maxPct)}
                      </span>
                    </div>
                    <span className='shrink-0'>{tier.count}개</span>
                  </div>
                ))}
                {tiers.length === 0 ? (
                  <div className='flex min-h-[46px] items-center px-4 py-3.5 text-white/50'>
                    벌칙 강도 설정이 없습니다.
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
