'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { jwtDecode } from 'jwt-decode';
import { ChevronDown, ThumbsUp, Trophy, X } from 'lucide-react';
import { getResultApi } from '@/api/generated/result-api-결과-조회/result-api-결과-조회';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { toast } from 'sonner';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { CloseButton } from '@/components/layout/CloseButton';
import { getToken } from '@/lib/getToken';
import { getProfileImageSrc } from '@/lib/profileImage';
import { isMobileOrTablet } from '@/lib/device';
import { useAuth } from '@/hooks/useAuth';

type ResultPenaltyItem = {
  content: string;
  count: number;
};

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

const formatEscapeTime = (totalMs: number) => {
  const totalSeconds = Math.floor(totalMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}분 ${seconds.toString().padStart(2, '0')}초`;
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

const getPenaltyContents = (member: ResultMember) =>
  member.penalties.items.flatMap((penalty) =>
    Array.from({ length: penalty.count }, () => penalty.content),
  );

export function TotalResult() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const { me } = useAuth();
  const isSharingRef = useRef(false);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [expandedPenaltyMemberIds, setExpandedPenaltyMemberIds] = useState<
    string[]
  >([]);
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
  const isSolo = rankedMembers.length <= 1;
  const penaltyMembers = rankedMembers.filter(
    (member) => member.penalties.totalCount > 0,
  );
  const tiers = result?.rule?.tierConfig?.tiers ?? [];
  const totalTime = formatSessionTime(result?.totalSessionMs ?? null);
  const completedSessions = result?.rule
    ? `${result.completedRounds ?? 0} / ${result.rule.rounds}`
    : '-';
  const isLoggedInUser = me?.role === 'user';
  const closeTarget = searchParams.get('from') === 'mypage' ? '/mypage' : '/';

  const togglePenaltyMember = (memberId: string) => {
    setExpandedPenaltyMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
  };

  const handleShare = async () => {
    if (isSharingRef.current) return;

    const shareUrl = window.location.href;
    const shareText = `${result?.roomTitle ?? '감옥'} 결과를 확인해보세요.\n${shareUrl}`;
    isSharingRef.current = true;

    try {
      if (isMobileOrTablet() && navigator.share) {
        try {
          await navigator.share({
            text: shareText,
          });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
        }
      }

      await navigator.clipboard.writeText(shareUrl);
      toast.success('URL이 복사되었어요.');
    } catch {
      toast.error('URL 복사에 실패했습니다.');
    } finally {
      isSharingRef.current = false;
    }
  };

  const HeaderComponent = (
    <>
      <HeaderTitle align='center'>통합 결과</HeaderTitle>
      <CloseButton onClick={() => router.push(closeTarget)} />
    </>
  );

  const BottomButtonComponent = (
    <div className='flex flex-col gap-2.5 bg-linear-to-t from-background from-65% to-transparent px-4 pt-8 pb-[calc(env(safe-area-inset-bottom)+12px)]'>
      <Button
        type='button'
        variant='outline'
        onClick={() => setIsContractDialogOpen(true)}
        className='h-12 w-full rounded-[14px] border-primary text-base font-bold text-muted-foreground'
      >
        계약서 보기
      </Button>
      <div className='grid grid-cols-2 gap-2.5'>
        <Button
          type='button'
          variant='secondary'
          onClick={handleShare}
          className='h-12 rounded-[14px] border border-white/10 bg-[#1A1F31] text-base font-bold text-white/85'
        >
          공유하기
        </Button>
        <Button
          type='button'
          variant='secondary'
          onClick={() => router.push(isLoggedInUser ? '/mypage' : '/')}
          className='h-12 rounded-[14px] border border-white/10 bg-[#1A1F31] text-base font-bold text-white/85'
        >
          {isLoggedInUser ? '마이페이지' : '홈 화면으로 이동'}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <MobileLayout
        header={HeaderComponent}
        bottomButton={result ? BottomButtonComponent : undefined}
        bottomFloating
      >
        <div className='flex min-w-0 flex-col gap-4 text-foreground'>
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
                <div className='mb-2 flex h-9 w-9 items-center justify-center rounded-full text-primary'>
                  <Trophy className='h-5 w-5 text-[#FBBF24]' />
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
                    {(result.penaltyMemberCount ?? 0) === 0
                      ? '0명'
                      : `${result.penaltyMemberCount}명`}
                  </strong>
                </div>
              </section>

              <section className='flex flex-col gap-2'>
                <h3 className='px-1 text-xs font-semibold text-muted-foreground'>
                  이탈 시간 순위
                </h3>
                <div className='overflow-hidden rounded-[14px] border border-slate-800/70 bg-[#151926]'>
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
                          {member.isAllClear ? (
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
                              <span className='truncate text-sm font-semibold text-slate-100'>
                                {member.nickname}
                                {member.isHost ? ' (방장)' : ''}
                                {isMe && !isSolo ? ' (나)' : ''}
                              </span>
                              {member.gaveUpAt ? (
                                <Badge className='h-5 shrink-0 border-none bg-destructive px-1.5 text-[10px] font-bold text-white hover:bg-destructive'>
                                  중도 포기
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <span className='shrink-0 text-xs font-medium text-slate-400'>
                          {formatEscapeTime(member.totalEscapeMs)}
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
                <div className='overflow-hidden rounded-[14px] bg-[#181828]'>
                  {penaltyMembers.length > 0 ? (
                    penaltyMembers.map((member) => {
                      const isMe =
                        me?.role === 'user' && member.userId === me.id;
                      const unknownPenaltyCount =
                        getUnknownPenaltyCount(member);
                      const isRoulettePending = unknownPenaltyCount > 0;
                      const isExpanded = expandedPenaltyMemberIds.includes(
                        member.memberId,
                      );
                      const penaltyContents = getPenaltyContents(member);
                      const profileImageSrc = getProfileImageSrc(
                        member.profileImage,
                      );

                      return (
                        <section
                          key={member.memberId}
                          className='border-t border-white/5 first:border-t-0'
                        >
                          <button
                            type='button'
                            onClick={() => togglePenaltyMember(member.memberId)}
                            aria-expanded={isExpanded}
                            aria-controls={`${member.memberId}-penalties`}
                            className='flex w-full items-center gap-2.5 px-4 py-[9px] text-left transition-colors hover:bg-white/[0.03]'
                          >
                            <Avatar className='h-9 w-9 shrink-0 border border-white/10 bg-[#2a2a3e]'>
                              {profileImageSrc ? (
                                <AvatarImage
                                  src={profileImageSrc}
                                  alt={`${member.nickname} 프로필 이미지`}
                                />
                              ) : null}
                              <AvatarFallback className='bg-transparent text-xs text-white/70'>
                                {member.nickname.slice(0, 1)}
                              </AvatarFallback>
                            </Avatar>
                            <div className='min-w-0 flex-1'>
                              <span className='truncate text-sm font-medium text-white/85'>
                                {member.nickname}
                                {member.isHost ? ' (방장)' : ''}
                                {isMe && !isSolo ? ' (본인)' : ''}
                              </span>
                            </div>
                            <span
                              className={`shrink-0 text-sm ${
                                isRoulettePending
                                  ? 'text-white/45'
                                  : 'text-white/75'
                              }`}
                            >
                              {isRoulettePending
                                ? '벌칙 뽑는 중'
                                : `벌칙 ${member.penalties.totalCount}개`}
                            </span>
                            <ChevronDown
                              className={`h-5 w-5 shrink-0 text-white/35 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                          {isExpanded ? (
                            <div
                              id={`${member.memberId}-penalties`}
                              className='bg-[#0f0f1a] px-4 py-3.5'
                            >
                              {isRoulettePending ? (
                                <p className='text-center text-sm text-white/70'>
                                  벌칙을 뽑고 있어요.
                                </p>
                              ) : (
                                <ul className='flex list-disc flex-col gap-2 pl-7 text-sm text-white/70 marker:text-white/70'>
                                  {penaltyContents.map((penalty, index) => (
                                    <li
                                      key={`${member.memberId}-penalty-${index}`}
                                    >
                                      {penalty}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ) : null}
                        </section>
                      );
                    })
                  ) : (
                    <div className='flex items-center gap-3 px-4 py-4 text-sm text-slate-300'>
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

      <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
        <DialogContent
          className='max-h-[82vh] w-[calc(100%-36px)] max-w-[354px] overflow-y-auto rounded-[18px] border border-white/10 bg-[#0f0d1a] p-[18px] pt-12 text-left text-white/85'
        >
          <DialogClose asChild>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              aria-label='닫기'
              className='absolute right-3 top-3 h-8 w-8 rounded-full text-white/70 hover:bg-white/10 hover:text-white'
            >
              <X className='h-4 w-4' />
            </Button>
          </DialogClose>
          <div className='flex flex-col gap-4'>
            <div className='flex items-center'>
              <div className='flex min-w-0 items-center pr-5'>
                <DialogTitle className='truncate text-base font-medium text-white/85'>
                  {result?.roomTitle ?? params.code}의 계약서
                </DialogTitle>
                <DialogDescription className='sr-only'>
                  완료된 집중 세션에서 사용한 계약서의 타이머, 벌칙 목록,
                  벌칙 강도 설정을 확인할 수 있습니다.
                </DialogDescription>
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
