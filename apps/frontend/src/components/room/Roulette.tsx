'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { getResultApi } from '@/api/generated/result-api-결과-조회/result-api-결과-조회';
import { getRouletteApi } from '@/api/generated/roulette-api-벌칙-룰렛/roulette-api-벌칙-룰렛';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import type {
  GiveUpRouletteResponseDto,
  ResultMemberDto,
  ResultResponseDto,
  SpinRouletteResponseDto,
} from '@/api/generated/models';
import { queryKeys } from '@/lib/queryKeys';

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

export function Roulette() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
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
  const hasShownNoPenaltyToastRef = useRef(false);
  const isGiveUpRoulette = searchParams.get('from') === 'giveup';
  const finishTarget = isGiveUpRoulette
    ? '/'
    : `/room/${params.code}/total-result`;

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
      router.push(finishTarget);
    },
    onError: (err) => {
      const errorData = axios.isAxiosError(err) ? err.response?.data : null;
      const rawMessage =
        errorData && typeof errorData === 'object' && 'message' in errorData
          ? (errorData as { message?: unknown }).message
          : undefined;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join(', ')
        : typeof rawMessage === 'string'
          ? rawMessage
          : undefined;

      if (
        axios.isAxiosError(err) &&
        (err.response?.status === 400 || err.response?.status === 409) &&
        message?.includes('이미 완료')
      ) {
        setIsDialogOpen(false);
        router.push(finishTarget);
        return;
      }

      setIsDialogOpen(false);
      router.push('/');
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
      router.replace('/');
    }
  }, [
    giveUpResult,
    giveUpSpinResults.length,
    isGiveUpResultError,
    isGiveUpResultLoading,
    isGiveUpRoulette,
    router,
  ]);

  const revealedChances = isGiveUpRoulette ? 0 : (myResult?.penaltyCount ?? 0);
  const totalChances = isGiveUpRoulette
    ? giveUpSpinResults.length
    : getUnrevealedPenaltyCount(myResult);
  const pickedSpins = Math.min(totalChances, currentIndex);
  const remainingChances = Math.max(0, totalChances - pickedSpins);
  const hasResolvedResult = isGiveUpRoulette || !!myResult;
  // 멤버 1명(혼자) 방: "다른 멤버"가 없으므로 완료 버튼 라벨을 분기.
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

  const handleStartSpinning = async () => {
    if (isAllCompleted) {
      router.push(finishTarget);
      return;
    }

    if (cannotStart) return;

    try {
      setSpinErrorMessage('');
      const spinResult = isGiveUpRoulette
        ? giveUpSpinResults[pickedSpins]
        : await spinMutation.mutateAsync(nextSpinIndex);
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
        setSpinErrorMessage('서버에서 받은 당첨 벌칙이 룰렛 목록에 없습니다.');
        return;
      }

      setCurrentSpinResult(spinResult);
      setIsSpinning(true);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        router.push(finishTarget);
        return;
      }

      setSpinErrorMessage(
        err instanceof Error ? err.message : '룰렛 실행에 실패했습니다.',
      );
    }
  };

  const handleStopSpinning = useCallback(() => {
    if (currentSpinResult) {
      setHistory((prev) => [...prev, currentSpinResult.penaltyContent]);
    }
    setCurrentIndex((prev) => prev + 1);
    setIsSpinning(false);
    setCurrentSpinResult(null);
  }, [currentSpinResult]);

  const handleExit = () => {
    if (isGiveUpRoulette) {
      router.push(finishTarget);
      return;
    }

    exitMutation.mutate();
  };

  return (
    <MobileLayout
      header={
        <div className='relative flex w-full items-center justify-between text-foreground'>
          <span className='mx-auto text-lg font-medium'>벌칙 룰렛</span>
          <button
            type='button'
            onClick={() =>
              !isSpinning && !isAllCompleted && setIsDialogOpen(true)
            }
            disabled={isSpinning || isAllCompleted}
            className='absolute right-0 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground disabled:pointer-events-none disabled:opacity-40'
            aria-label='룰렛 나가기'
          >
            <X className='h-5 w-5' />
          </button>
        </div>
      }
      bottomButton={
        <Button
          variant='default'
          size='main'
          className='w-full rounded-xl'
          onClick={handleStartSpinning}
          disabled={cannotStart && !isAllCompleted}
        >
          {(isGiveUpRoulette ? isGiveUpResultLoading : isResultLoading)
            ? '룰렛 준비 중...'
            : spinMutation.isPending
              ? '당첨 벌칙 확인 중...'
              : isSpinning
                ? '룰렛 돌리는 중...'
                : isAllCompleted
                  ? isGiveUpRoulette
                    ? '홈 화면으로 이동'
                    : isSoloMember
                      ? '결과 확인하기'
                      : '다른 멤버 벌칙 보기'
                  : `룰렛 돌리기 (${Math.max(
                      0,
                      remainingChances,
                    )}/${totalChances})`}
        </Button>
      }
    >
      <div className='flex min-w-0 flex-col gap-6 pb-6 text-foreground'>
        <div className='rounded-2xl border border-[var(--roulette-panel-border)] bg-[var(--roulette-panel)] p-4 text-center'>
          <div className='text-sm text-muted-foreground'>
            남은 시간
            <span className='ml-1 text-base font-bold text-destructive'>
              {remainingTime}
            </span>
          </div>
        </div>

        <div className='flex w-full min-w-0 flex-col items-center rounded-2xl border border-[var(--roulette-card-border)] bg-[var(--roulette-card)] px-4 py-6'>
          <h2 className='mb-6 text-lg font-bold'>오늘의 벌칙 뽑기</h2>
          <PenaltyRoulette
            mustStartSpinning={isSpinning}
            targetIndex={targetIndex}
            onStopSpinning={handleStopSpinning}
            items={rouletteLabels}
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

        <div className='flex flex-col gap-2'>
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
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className='flex w-[calc(100%-32px)] max-w-[228px] flex-col items-start gap-4 overflow-hidden rounded-3xl border-0 bg-[var(--roulette-dialog)] p-4 text-center shadow-[0_0_10px_rgba(0,0,0,0.1)]'>
          <section className='flex w-full flex-col items-start gap-3 py-3 text-left'>
            <DialogTitle className='text-base font-semibold leading-[150%] text-foreground'>
              룰렛 횟수가 아직 남았어요.
            </DialogTitle>
            <DialogDescription className='text-xs font-medium leading-5 text-foreground/75'>
              벌칙이 자동으로 결정돼요.
            </DialogDescription>
          </section>
          <div className='grid w-full grid-cols-2 items-center gap-3'>
            <Button
              type='button'
              variant='secondary'
              onClick={() => setIsDialogOpen(false)}
              className='h-14 rounded-[14px] border border-[var(--roulette-dialog-secondary-border)] bg-[var(--roulette-dialog-secondary)] text-sm font-bold text-foreground/70'
            >
              취소
            </Button>
            <Button
              type='button'
              onClick={handleExit}
              disabled={exitMutation.isPending}
              className='h-14 rounded-[14px] bg-primary text-sm font-bold text-primary-foreground'
            >
              {exitMutation.isPending ? '처리 중...' : '나가기'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}
