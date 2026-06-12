'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { getResultApi } from '@/api/generated/result-api-결과-조회/result-api-결과-조회';
import { getRouletteApi } from '@/api/generated/roulette-api-벌칙-룰렛/roulette-api-벌칙-룰렛';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useBlockBrowserBack } from '@/hooks/useBlockBrowserBack';
import { clearGuestAccessToken } from '@/lib/authToken';
import type {
  ExitRouletteResponseDto,
  GiveUpRouletteResponseDto,
  ResultMemberDto,
  ResultResponseDto,
  SpinRouletteResponseDto,
} from '@/api/generated/models';
import { queryKeys } from '@/lib/queryKeys';
import { CloseButton } from '../layout/CloseButton';

const PenaltyRoulette = dynamic(
  () => import('@/components/ui/custom-roulette'),
  {
    ssr: false,
    loading: () => (
      <div className='mx-auto aspect-square w-full max-w-[320px] rounded-full border-2 border-[var(--roulette-panel-border)] bg-[var(--roulette-wheel-center)]' />
    ),
  },
);

type RoulettePenalty = {
  id: string;
  label: string;
};

type RouletteRulePenalty = {
  itemId: string;
  content: string;
};

const formatRemainingTime = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
};

const getRemainingSeconds = (
  serverTime: string,
  rouletteEndsAt: string | null,
  dataUpdatedAt: number,
  now: number,
) => {
  if (!rouletteEndsAt) return 0;

  const elapsedMs = Math.max(0, now - dataUpdatedAt);
  const adjustedServerNow = new Date(serverTime).getTime() + elapsedMs;
  const remainingMs = new Date(rouletteEndsAt).getTime() - adjustedServerNow;

  return Math.max(0, Math.floor(remainingMs / 1000));
};

const toRouletteItems = (penalties: RouletteRulePenalty[] = []) =>
  penalties.map((item) => ({
    id: item.itemId,
    label: item.content,
  }));

const shuffleItems = <T,>(items: T[]) => {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
};

const getUnrevealedPenaltyCount = (
  member: ResultMemberDto | null | undefined,
) =>
  Math.max(
    0,
    (member?.penalties.totalCount ?? 0) - (member?.penaltyCount ?? 0),
  );

// 총 뽑을 횟수가 이 값 이상이면 '결과 바로보기'(룰렛 스킵) 노출
const SKIP_THRESHOLD = 5;
const SPOTLIGHT_DURATION_MS = 2400;

// axios 에러 응답의 message(string | string[])를 단일 문자열로 정규화
const getAxiosMessage = (err: unknown): string | undefined => {
  const errorData = axios.isAxiosError(err) ? err.response?.data : null;
  const rawMessage =
    errorData && typeof errorData === 'object' && 'message' in errorData
      ? (errorData as { message?: unknown }).message
      : undefined;

  return Array.isArray(rawMessage)
    ? rawMessage.join(', ')
    : typeof rawMessage === 'string'
      ? rawMessage
      : undefined;
};

export function Roulette() {
  useBlockBrowserBack();

  const router = useRouter();
  const params = useParams<{ code: string }>();
  const queryClient = useQueryClient();
  const { me } = useAuth();
  const searchParams = useSearchParams();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [currentSpinResult, setCurrentSpinResult] =
    useState<SpinRouletteResponseDto | null>(null);
  const [spinErrorMessage, setSpinErrorMessage] = useState('');

  const [spotlightLabel, setSpotlightLabel] = useState<string | null>(null);
  const [skipEverQualified, setSkipEverQualified] = useState(false);
  const hasShownNoPenaltyToastRef = useRef(false);
  const skipInitiatedRef = useRef(false);
  const manualSpinRef = useRef(false);
  const isGiveUpRoulette = searchParams.get('from') === 'giveup';
  const finishTarget = isGiveUpRoulette
    ? '/'
    : `/room/${params.code}/total-result`;

  const clearGuestSession = useCallback(() => {
    if (clearGuestAccessToken()) {
      queryClient.setQueryData(['me'], null);
    }
  }, [queryClient]);

  const moveToFinishTarget = useCallback(
    () => {
      if (finishTarget === '/') {
        clearGuestSession();
      }
      router.replace(finishTarget);
    },
    [clearGuestSession, finishTarget, router],
  );

  const {
    data: result,
    dataUpdatedAt,
    isError: isResultError,
    isLoading: isResultLoading,
  } = useQuery({
    queryKey: queryKeys.result.detail(params.code),
    queryFn: async () => {
      const res = await getResultApi().resultControllerGetResult(params.code);
      return res.data as unknown as ResultResponseDto;
    },
    enabled: !isGiveUpRoulette,
  });

  const {
    data: giveUpResult,
    isError: isGiveUpResultError,
    isLoading: isGiveUpResultLoading,
    dataUpdatedAt: giveUpDataUpdatedAt,
  } = useQuery({
    queryKey: queryKeys.result.giveUp(params.code),
    queryFn: async () => {
      const res = await getRouletteApi().rouletteControllerGetGiveUpResult(
        params.code,
      );
      return res.data as unknown as GiveUpRouletteResponseDto;
    },
    enabled: isGiveUpRoulette,
  });

  const rouletteItems = useMemo<RoulettePenalty[]>(
    () =>
      toRouletteItems(
        isGiveUpRoulette ? giveUpResult?.penaltyPool : result?.rule?.penalties,
      ),
    [giveUpResult, isGiveUpRoulette, result],
  );

  const myResult = useMemo(() => {
    if (!result || !me) return null;

    if (me?.role === 'user') {
      return result.members.find((member) => member.userId === me.id) ?? null;
    }

    if (me?.role === 'guest') {
      return (
        result.members.find((member) => member.guestToken === me.id) ?? null
      );
    }

    return null;
  }, [me, result]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  const spinMutation = useMutation({
    mutationFn: async (spinIndex: number) => {
      const res = await getRouletteApi().rouletteControllerSpinRoulette(
        params.code,
        { spinIndex },
      );

      return res.data as unknown as SpinRouletteResponseDto;
    },
  });

  const exitMutation = useMutation({
    mutationFn: async () => {
      const res = await getRouletteApi().rouletteControllerExitRoulette(
        params.code,
      );

      return res.data;
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      moveToFinishTarget();
    },
    onError: (err) => {
      const message = getAxiosMessage(err);

      if (
        axios.isAxiosError(err) &&
        (err.response?.status === 400 || err.response?.status === 409) &&
        message?.includes('이미 완료')
      ) {
        setIsDialogOpen(false);
        moveToFinishTarget();
        return;
      }

      setIsDialogOpen(false);
      clearGuestSession();
      router.push('/');
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      const res = await getRouletteApi().rouletteControllerExitRoulette(
        params.code,
      );

      return res.data as unknown as ExitRouletteResponseDto;
    },
    // 진행 중 자동추첨 스핀의 뒷처리를 무효화하도록 즉시 래치
    onMutate: () => {
      skipInitiatedRef.current = true;
    },
    onSuccess: (data) => {
      // exit 응답의 revealedPenalties = 미공개 전체 목록 → history 완성하고 완료 처리
      const revealed = (data?.revealedPenalties ?? []).flatMap((p) =>
        Array.from({ length: p.count }, () => p.content),
      );
      setHistory(revealed);
      setCurrentSpinResult(null);
      setIsSpinning(false);
      setCurrentIndex(totalChances);
      toast.success('벌칙 결과를 모두 자동으로 뽑았어요');
    },
    onError: (err) => {
      const message = getAxiosMessage(err);

      // 타임아웃 자동공개 등으로 이미 완료된 드문 경합 → 결과 페이지로 폴백 이동
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 400 &&
        message?.includes('이미 완료')
      ) {
        moveToFinishTarget();
        return;
      }

      // 그 외 실패는 화면 유지(수동/자동추첨 계속 가능) → 래치 해제해 자동추첨 재개
      skipInitiatedRef.current = false;
      toast.error('처리하지 못했어요. 잠시 후 다시 시도해주세요.');
    },
  });

  const giveUpSpinResults = useMemo(() => {
    const penalties = giveUpResult?.penalties ?? [];

    return shuffleItems(
      penalties.flatMap((penalty) =>
        Array.from({ length: penalty.count }, () => ({
          spinIndex: 0,
          penaltyItemId: penalty.itemId,
          penaltyContent: penalty.content,
          remainingSpins: 0,
          isFinished: false,
        })),
      ),
    );
  }, [giveUpResult]);

  useEffect(() => {
    if (!isGiveUpRoulette || isGiveUpResultLoading || isGiveUpResultError) {
      return;
    }

    if (giveUpResult && giveUpSpinResults.length === 0) {
      if (!hasShownNoPenaltyToastRef.current) {
        toast.info('뽑을 벌칙이 없어요');
        hasShownNoPenaltyToastRef.current = true;
      }
      clearGuestSession();
      router.replace('/');
    }
  }, [
    giveUpResult,
    giveUpSpinResults.length,
    isGiveUpResultError,
    isGiveUpResultLoading,
    isGiveUpRoulette,
    clearGuestSession,
    router,
  ]);

  const revealedChances = isGiveUpRoulette ? 0 : (myResult?.penaltyCount ?? 0);
  const totalChances = isGiveUpRoulette
    ? giveUpSpinResults.length
    : getUnrevealedPenaltyCount(myResult);
  const pickedSpins = Math.min(totalChances, currentIndex);
  const remainingChances = Math.max(0, totalChances - pickedSpins);
  const hasResolvedResult = isGiveUpRoulette || !!myResult;

  const isSoloMember = (result?.members?.length ?? 0) <= 1;
  const isAllCompleted =
    (hasResolvedResult && totalChances === 0) ||
    (totalChances > 0 && remainingChances === 0) ||
    !!spinMutation.data?.isFinished;
  const nextSpinIndex = revealedChances + pickedSpins + 1;
  const remainingSeconds = result
    ? getRemainingSeconds(
        result.serverTime,
        result.rouletteEndsAt,
        dataUpdatedAt,
        now,
      )
    : 0;
  const remainingTime = formatRemainingTime(remainingSeconds);

  // 10분 제한 시간 경과(서버시간 보정 기준)
  const isExpired = !isGiveUpRoulette && !!result && remainingSeconds <= 0;
  // 중도포기 룰렛 제한 시간 경과
  const giveUpRemainingSeconds = giveUpResult
    ? getRemainingSeconds(
        giveUpResult.serverTime,
        giveUpResult.rouletteEndsAt,
        giveUpDataUpdatedAt,
        now,
      )
    : 0;
  const isGiveUpExpired =
    isGiveUpRoulette && !!giveUpResult && giveUpRemainingSeconds <= 0;
  // 자동추첨까지 끝났거나(전부 공개), 타임아웃인데 뽑을 게 없으면 완료
  const isCompleted = isAllCompleted || (isExpired && remainingChances <= 0);
  // 휠 정지까지 끝난 진짜 완료 (연출 중 버튼/문구 깜빡임 방지)
  const isDrawDone = isCompleted && !isSpinning;
  // 타임아웃 자동추첨 진행 중 (남은 벌칙을 자동으로 돌리는 상태)
  const isAutoDraw = isExpired && remainingChances > 0;

  // '결과 바로보기'(스킵) 노출 자격: 총 뽑을 횟수가 5회 이상을 한 번이라도 충족하면 래치로 고정.
  // (서버 데이터 갱신으로 totalChances가 흔들려도 노출 자격은 유지 — 최종 노출은 남은 횟수로 제어)
  // 렌더 중 1회성 상태 보정(React 권장 패턴): !skipEverQualified 가드로 무한 루프 방지.
  if (
    !skipEverQualified &&
    !isGiveUpRoulette &&
    !!myResult &&
    totalChances >= SKIP_THRESHOLD
  ) {
    setSkipEverQualified(true);
  }

  // 노출 = 자격 래치 + 남은 횟수 2회 이상. 남은 1회 이하면 스킵이 무의미하므로 미노출. (give-up 제외)
  const skipVisibleNow =
    !isGiveUpRoulette &&
    !!myResult &&
    skipEverQualified &&
    remainingChances > 1;

  const isManualSkippable =
    !isAutoDraw && !isCompleted && !isSpinning && !spinMutation.isPending;
  const canSkipNow =
    skipVisibleNow &&
    !skipMutation.isPending &&
    (isAutoDraw || isManualSkippable);

  const rouletteLabels = useMemo(
    () => rouletteItems.map((item) => item.label),
    [rouletteItems],
  );

  const targetIndex = useMemo(
    () =>
      rouletteItems.findIndex(
        (item) =>
          item.id === currentSpinResult?.penaltyItemId ||
          item.label === currentSpinResult?.penaltyContent,
      ),
    [currentSpinResult, rouletteItems],
  );

  const hasRouletteItems = rouletteItems.length > 0;
  const hasInvalidTarget = !!currentSpinResult && targetIndex < 0;
  const cannotStart =
    (isGiveUpRoulette ? isGiveUpResultLoading : isResultLoading) ||
    (isGiveUpRoulette ? isGiveUpResultError : isResultError) ||
    spinMutation.isPending ||
    isSpinning ||
    !hasRouletteItems ||
    (!isGiveUpRoulette && !myResult) ||
    hasInvalidTarget;

  const handleStartSpinning = useCallback(
    async (auto = false) => {
      if (isCompleted) {
        moveToFinishTarget();
        return;
      }

      // 스킵 진행 중이면 새 스핀 시작 금지(자동추첨 루프가 끼어드는 것 차단)
      if (skipInitiatedRef.current) return;

      if (cannotStart) return;

      try {
        setSpinErrorMessage('');
        const spinResult = isGiveUpRoulette
          ? giveUpSpinResults[pickedSpins]
          : await spinMutation.mutateAsync(nextSpinIndex);
        // 대기 중 스킵이 시작됐으면 이 스핀 결과는 폐기(완료 처리로 대체)
        if (skipInitiatedRef.current) return;
        if (!spinResult) {
          setSpinErrorMessage('룰렛 결과를 찾을 수 없습니다.');
          return;
        }
        const spinTargetIndex = rouletteItems.findIndex(
          (item) =>
            item.id === spinResult.penaltyItemId ||
            item.label === spinResult.penaltyContent,
        );

        if (spinTargetIndex < 0) {
          setSpinErrorMessage(
            '서버에서 받은 당첨 벌칙이 룰렛 목록에 없습니다.',
          );
          return;
        }

        manualSpinRef.current = !auto;
        setCurrentSpinResult(spinResult);
        setIsSpinning(true);
      } catch (err) {
        // 스킵 진행 중 끼어든 스핀이 409(이미 공개)로 떨어져도 이탈시키지 않음(스킵이 완료 처리)
        if (skipInitiatedRef.current) return;

        if (axios.isAxiosError(err) && err.response?.status === 409) {
          moveToFinishTarget();
          return;
        }

        setSpinErrorMessage(
          err instanceof Error ? err.message : '룰렛 실행에 실패했습니다.',
        );
      }
    },
    [
      isCompleted,
      moveToFinishTarget,
      cannotStart,
      isGiveUpRoulette,
      giveUpSpinResults,
      pickedSpins,
      spinMutation,
      nextSpinIndex,
      rouletteItems,
    ],
  );

  const handleStopSpinning = useCallback(() => {
    // 스킵이 시작된 뒤 뒤늦게 도착한 '바퀴 정지' 신호는 결과 집계를 건너뛴다.
    // (스킵 성공 콜백이 이미 최종 목록을 확정 → 중복 추가 방지). 단 바퀴 상태는 정리해 멈춤 방지.
    if (skipInitiatedRef.current) {
      setIsSpinning(false);
      setCurrentSpinResult(null);
      return;
    }
    if (currentSpinResult) {
      setHistory((prev) => [...prev, currentSpinResult.penaltyContent]);
      // 수동 실행으로 멈춘 경우에만 '취조실 조명' 연출 발동
      if (manualSpinRef.current) {
        setSpotlightLabel(currentSpinResult.penaltyContent);
      }
    }
    manualSpinRef.current = false;
    setCurrentIndex((prev) => prev + 1);
    setIsSpinning(false);
    setCurrentSpinResult(null);
  }, [currentSpinResult]);

  // 연출 자동 종료: 노출 후 SPOTLIGHT_DURATION_MS 뒤 사라짐(언마운트 시 타이머 정리)
  useEffect(() => {
    if (!spotlightLabel) return;

    const timerId = window.setTimeout(
      () => setSpotlightLabel(null),
      SPOTLIGHT_DURATION_MS,
    );

    return () => window.clearTimeout(timerId);
  }, [spotlightLabel]);

  const selectedPenaltyRef = useRef<HTMLDivElement | null>(null);

  // 룰렛이 완전히 멈춘 뒤(전부 완료) 선택된 벌칙 섹션으로 1회 스크롤 이동.
  useEffect(() => {
    if (
      !isSpinning &&
      isAllCompleted &&
      history.length > 0 &&
      !spotlightLabel
    ) {
      const timerId = window.setTimeout(() => {
        const el = selectedPenaltyRef.current;
        if (!el) return;

        const headerHeight =
          document.querySelector('header')?.getBoundingClientRect().height ??
          58;
        const absoluteTop =
          el.getBoundingClientRect().top + window.scrollY - headerHeight - 12;

        window.scrollTo({ top: Math.max(0, absoluteTop), behavior: 'smooth' });
      }, 500);

      return () => window.clearTimeout(timerId);
    }
  }, [isSpinning, isAllCompleted, history.length, spotlightLabel]);

  const autoDrawStartedRef = useRef(false);
  useEffect(() => {
    if (!isAutoDraw) {
      autoDrawStartedRef.current = false;
      return;
    }
    if (autoDrawStartedRef.current) return;
    autoDrawStartedRef.current = true;
    toast.error('시간이 초과되었습니다');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [isAutoDraw]);

  useEffect(() => {
    if (!isAutoDraw || isAllCompleted) return;
    if (isSpinning || spinMutation.isPending || skipMutation.isPending) return;
    if (isDialogOpen || exitMutation.isPending) return;
    const id = setTimeout(() => {
      void handleStartSpinning(true); // 자동추첨: 연출 미발동
    }, 150);
    return () => clearTimeout(id);
  }, [
    isAutoDraw,
    isAllCompleted,
    isSpinning,
    spinMutation.isPending,
    skipMutation.isPending,
    isDialogOpen,
    exitMutation.isPending,
    handleStartSpinning,
  ]);

  // 페이지 진입 시 뽑을 룰렛이 없는 경우(시간 만료+잔여 횟수 없음 OR 아이템 목록 없음) total-result로 이동
  useEffect(() => {
    if (isGiveUpRoulette) return;
    if (isResultLoading || !result) return;
    const shouldSkip =
      (isExpired && remainingChances <= 0) || !hasRouletteItems;
    if (shouldSkip && !isSpinning && history.length === 0) {
      moveToFinishTarget();
    }
  }, [
    isGiveUpRoulette,
    isResultLoading,
    result,
    isExpired,
    remainingChances,
    hasRouletteItems,
    isSpinning,
    history.length,
    moveToFinishTarget,
  ]);

  // 중도포기 룰렛: 진입 시 또는 진행 중 만료 시 메인으로 이동
  const giveUpExpiredToastShownRef = useRef(false);
  useEffect(() => {
    if (!isGiveUpRoulette) return;
    if (isGiveUpResultLoading || !giveUpResult) return;
    if (!isGiveUpExpired) {
      giveUpExpiredToastShownRef.current = false;
      return;
    }
    if (giveUpExpiredToastShownRef.current) return;
    giveUpExpiredToastShownRef.current = true;
    toast.error('시간이 초과되어 벌칙이 자동으로 결정됩니다.');
    moveToFinishTarget();
  }, [
    isGiveUpRoulette,
    isGiveUpResultLoading,
    giveUpResult,
    isGiveUpExpired,
    moveToFinishTarget,
  ]);

  // 중도포기 룰렛: 패널티풀이 비어있으면 메인으로 이동
  useEffect(() => {
    if (!isGiveUpRoulette) return;
    if (isGiveUpResultLoading || !giveUpResult) return;
    if (!hasRouletteItems && !isSpinning && history.length === 0) {
      moveToFinishTarget();
    }
  }, [
    isGiveUpRoulette,
    isGiveUpResultLoading,
    giveUpResult,
    hasRouletteItems,
    isSpinning,
    history.length,
    moveToFinishTarget,
  ]);

  const handleExit = () => {
    if (isGiveUpRoulette) {
      moveToFinishTarget();
      return;
    }

    exitMutation.mutate();
  };

  return (
    <MobileLayout
      header={
        <div className='flex w-full items-center justify-between text-foreground'>
          <span className='mx-auto text-lg font-medium'>벌칙 룰렛</span>
          <CloseButton
            onClick={() => {
              if (isCompleted) {
                moveToFinishTarget();
              } else {
                setIsDialogOpen(true);
              }
            }}
            aria-label='룰렛 나가기'
          ></CloseButton>
        </div>
      }
      bottomButton={
        <div className='flex w-full flex-row gap-2'>
          {skipVisibleNow ? (
            <Button
              type='button'
              variant='secondary'
              size='main'
              className='flex-2 whitespace-nowrap rounded-[14px] px-2 font-bold'
              onClick={() => skipMutation.mutate()}
              disabled={!canSkipNow}
            >
              {skipMutation.isPending ? '처리 중...' : '결과 바로보기'}
            </Button>
          ) : null}
          <Button
            variant='default'
            size='main'
            className='flex-3 rounded-[14px] font-bold'
            onClick={() => handleStartSpinning()}
            disabled={
              isSpinning || ((cannotStart || isAutoDraw) && !isDrawDone)
            }
          >
            {(isGiveUpRoulette ? isGiveUpResultLoading : isResultLoading)
              ? '룰렛 준비 중...'
              : isAutoDraw
                ? `자동으로 뽑는중 (${remainingChances}/${totalChances})`
                : spinMutation.isPending
                  ? '당첨 벌칙 확인 중...'
                  : isSpinning
                    ? '룰렛 돌리는 중...'
                    : isCompleted
                      ? isGiveUpRoulette
                        ? '홈 화면으로 이동'
                        : isSoloMember
                          ? '최종 결과 확인'
                          : '다른 멤버 벌칙 보기'
                      : `룰렛 돌리기 (${Math.max(
                          0,
                          remainingChances,
                        )}/${totalChances})`}
          </Button>
        </div>
      }
    >
      <div className='flex min-w-0 flex-col gap-4 pb-6 text-foreground'>
        <div className='rounded-[14px] border border-[var(--roulette-panel-border)] bg-[var(--roulette-panel)] p-4 text-center'>
          {isDrawDone ? (
            <div className='text-sm font-bold text-foreground'>
              벌칙을 다 뽑았어요
            </div>
          ) : isAutoDraw ? (
            <div className='text-sm font-bold text-foreground'>
              시간 초과되어 자동으로 벌칙을 뽑습니다
            </div>
          ) : (
            <div className='text-sm text-muted-foreground'>
              남은 시간
              <span className='ml-1 text-base font-bold text-destructive'>
                {remainingTime}
              </span>
            </div>
          )}
        </div>

        <div className='flex w-full min-w-0 flex-col items-center rounded-[14px] border border-[var(--roulette-card-border)] bg-[var(--roulette-card)] px-4 py-6'>
          <h2 className='mb-6 text-lg font-bold'>오늘의 벌칙 뽑기</h2>
          <PenaltyRoulette
            mustStartSpinning={isSpinning}
            targetIndex={targetIndex}
            onStopSpinning={handleStopSpinning}
            items={rouletteLabels}
            spinDuration={isAutoDraw ? 0.2 : undefined}
            isDrawDone={isDrawDone}
          />
          {(isGiveUpRoulette ? isGiveUpResultError : isResultError) ? (
            <p className='mt-4 text-sm text-destructive'>
              룰렛 목록을 불러오지 못했습니다.
            </p>
          ) : null}
          {!(isGiveUpRoulette ? isGiveUpResultLoading : isResultLoading) &&
          !hasRouletteItems ? (
            <p className='mt-4 text-sm text-destructive'>
              룰렛에 사용할 벌칙 목록이 없습니다.
            </p>
          ) : null}
          {!isGiveUpRoulette && !isResultLoading && !myResult ? (
            <p className='mt-4 text-sm text-destructive'>
              내 룰렛 정보를 찾을 수 없습니다.
            </p>
          ) : null}
          {hasInvalidTarget ? (
            <p className='mt-4 text-sm text-destructive'>
              서버에서 받은 당첨 벌칙이 룰렛 목록에 없습니다.
            </p>
          ) : null}
          {spinErrorMessage ? (
            <p className='mt-4 text-sm text-destructive'>{spinErrorMessage}</p>
          ) : null}
        </div>

        {history.length > 0 && (
          <div ref={selectedPenaltyRef} className='flex flex-col gap-2'>
            <h3 className='mb-1 text-sm font-semibold text-muted-foreground'>
              선택된 벌칙
            </h3>
            {history.map((penalty, idx) => (
              <div
                key={`${penalty}-${idx}`}
                className='flex items-center gap-3 rounded-xl border border-[var(--roulette-history-border)] bg-[var(--roulette-history)] p-4'
              >
                <div className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground'>
                  {idx + 1}
                </div>
                <span className='min-w-0 text-sm font-medium'>{penalty}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>룰렛 횟수가 아직 남았어요.</DialogTitle>
            <DialogDescription>벌칙이 자동으로 결정돼요.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type='button'
              variant='secondary'
              onClick={() => setIsDialogOpen(false)}
              className='flex-1 h-12 rounded-lg'
            >
              취소
            </Button>
            <Button
              type='button'
              onClick={handleExit}
              disabled={exitMutation.isPending}
              className='flex-1 h-12 rounded-lg font-bold'
            >
              {exitMutation.isPending ? '처리 중...' : '나가기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 취조실 조명: 수동 룰렛 완료 시 본문을 어둡게 깔고, 위에서 내려오는 원뿔형 빛줄기로 결과 강조.
          z-40 = 헤더/하단 버튼 고정영역(z-50)보다 아래 → 그 둘은 가리지 않고 본문만 덮는다. */}
      {spotlightLabel ? (
        <div
          aria-hidden
          className='pointer-events-none fixed inset-0 z-40'
          style={{ animation: 'spotlightIn 0.2s ease-out both' }}
        >
          {/* 1) 어두운 배경 오버레이 (전체 화면) */}
          <div
            className='absolute inset-0'
            style={{ background: 'rgba(0, 0, 0, 0.85)' }}
          />

          {/* 2) 원뿔형 빛줄기: 상단 중앙(좁음) → 하단(넓음) 사다리꼴, 위→아래로 밝기 감소 */}
          <div
            className='absolute inset-0'
            style={{
              clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
              background:
                'linear-gradient(to bottom, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.12) 50%, transparent 85%)',
            }}
          />

          {/* 3) 결과 텍스트: 빛을 받는 최상단 레이어 + 흰색 후광 */}
          <div className='absolute inset-0 z-10 flex flex-col items-center justify-center px-10 text-center'>
            {/* 반투명 검은 박스: 밝은 빛줄기 위에서도 텍스트 대비가 충분하도록 감싼다 */}
            <div className='flex flex-col items-center rounded-[14px] mb-2 bg-black/60 px-4 py-2 text-xs font-semibold  text-white/70'>
              벌칙 확정
            </div>
            <span
              className='text-2xl font-extrabold text-white'
              style={{
                textShadow:
                  '0 0 12px rgba(255,255,255,0.7), 0 0 32px rgba(255,255,255,0.4)',
              }}
            >
              {spotlightLabel}
            </span>
          </div>
        </div>
      ) : null}
    </MobileLayout>
  );
}
