'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { toast } from 'sonner';
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
import { useBlockBrowserBack } from '@/hooks/useBlockBrowserBack';
import {
  getAxiosMessage,
  getUnrevealedPenaltyCount,
  useRouletteData,
} from './useRouletteData';
import { CloseButton } from '@/components/layout/CloseButton';
import { RouletteWheel } from './RouletteWheel';
import { RouletteHistory } from './RouletteHistory';
import { RouletteTimer } from './RouletteTimer';

const SKIP_THRESHOLD = 5;
const SPOTLIGHT_DURATION_MS = 2400;

export function Roulette() {
  useBlockBrowserBack();

  const router = useRouter();
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const isGiveUpRoulette = searchParams.get('from') === 'giveup';
  const finishTarget = isGiveUpRoulette
    ? '/'
    : `/room/${params.code}/total-result`;

  const data = useRouletteData(params.code, isGiveUpRoulette);

  // ── Local state ──
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTimerExpired, setIsTimerExpired] = useState(false);
  const [currentSpinResult, setCurrentSpinResult] = useState<{
    penaltyItemId: string | null;
    penaltyContent: string;
    isFinished?: boolean;
  } | null>(null);
  const [spinErrorMessage, setSpinErrorMessage] = useState('');
  const [spotlightLabel, setSpotlightLabel] = useState<string | null>(null);
  const [skipEverQualified, setSkipEverQualified] = useState(false);

  // ── Refs ──
  const hasShownNoPenaltyToastRef = useRef(false);
  const skipInitiatedRef = useRef(false);
  const manualSpinRef = useRef(false);
  const selectedPenaltyRef = useRef<HTMLDivElement | null>(null);
  const autoDrawStartedRef = useRef(false);

  // ── Derived values ──
  const totalChances = isGiveUpRoulette
    ? data.giveUpSpinResults.length
    : getUnrevealedPenaltyCount(data.myResult);
  const pickedSpins = Math.min(totalChances, currentIndex);
  const remainingChances = Math.max(0, totalChances - pickedSpins);
  const hasResolvedResult = isGiveUpRoulette || !!data.myResult;
  const nextSpinIndex = data.revealedChances + pickedSpins + 1;

  const isExpired = !isGiveUpRoulette && !!data.result && isTimerExpired;
  const isGiveUpExpired =
    isGiveUpRoulette && !!data.giveUpResult && isTimerExpired;

  const isAllCompleted =
    (hasResolvedResult && totalChances === 0) ||
    (totalChances > 0 && remainingChances === 0) ||
    !!data.spinMutation.data?.isFinished;

  const isCompleted =
    isAllCompleted || ((isExpired || isGiveUpExpired) && remainingChances <= 0);
  const isDrawDone = isCompleted && !isSpinning;
  const isAutoDraw = (isExpired || isGiveUpExpired) && remainingChances > 0;

  if (
    !skipEverQualified &&
    !isGiveUpRoulette &&
    !!data.myResult &&
    totalChances >= SKIP_THRESHOLD
  ) {
    setSkipEverQualified(true);
  }
  const skipVisibleNow =
    !isGiveUpRoulette &&
    !!data.myResult &&
    skipEverQualified &&
    remainingChances > 1;
  const canSkipNow =
    skipVisibleNow &&
    !data.skipMutation.isPending &&
    (isAutoDraw ||
      (!isAutoDraw &&
        !isCompleted &&
        !isSpinning &&
        !data.spinMutation.isPending));

  const targetIndex = useMemo(
    () =>
      data.rouletteItems.findIndex(
        (item) =>
          item.id === currentSpinResult?.penaltyItemId ||
          item.label === currentSpinResult?.penaltyContent,
      ),
    [currentSpinResult, data.rouletteItems],
  );

  const cannotStart =
    (isGiveUpRoulette ? data.isGiveUpResultLoading : data.isResultLoading) ||
    (isGiveUpRoulette ? data.isGiveUpResultError : data.isResultError) ||
    data.spinMutation.isPending ||
    isSpinning ||
    !data.hasRouletteItems ||
    (!isGiveUpRoulette && !data.myResult) ||
    (!!currentSpinResult && targetIndex < 0);

  // ── Navigation ──
  const moveToFinishTarget = useCallback(() => {
    if (finishTarget === '/') {
      data.clearGuestSession();
    } else {
      sessionStorage.setItem('totalResultFrom', 'room');
    }
    router.replace(finishTarget);
  }, [data, finishTarget, router]);

  // ── Handlers ──
  const handleStartSpinning = useCallback(
    async (auto = false) => {
      if (isCompleted) {
        moveToFinishTarget();
        return;
      }
      if (skipInitiatedRef.current || cannotStart) return;
      setSpotlightLabel(null);
      try {
        setSpinErrorMessage('');
        const spinResult = isGiveUpRoulette
          ? data.giveUpSpinResults[pickedSpins]
          : await data.spinMutation.mutateAsync(nextSpinIndex);
        if (skipInitiatedRef.current || !spinResult) {
          if (!spinResult) setSpinErrorMessage('벌칙 룰렛 결과를 찾을 수 없어요.');
          return;
        }
        const idx = data.rouletteItems.findIndex(
          (item) =>
            item.id === spinResult.penaltyItemId ||
            item.label === spinResult.penaltyContent,
        );
        if (idx < 0) {
          setSpinErrorMessage(
            '서버에서 받은 당첨 벌칙이 룰렛 목록에 없습니다.',
          );
          return;
        }
        manualSpinRef.current = !auto;
        setCurrentSpinResult(spinResult);
        setIsSpinning(true);
      } catch (err) {
        if (skipInitiatedRef.current) return;
        if (axios.isAxiosError(err) && err.response?.status === 409) {
          moveToFinishTarget();
          return;
        }
        setSpinErrorMessage(
          err instanceof Error ? err.message : '벌칙 룰렛 결정에 실패했어요.',
        );
      }
    },
    [
      isCompleted,
      moveToFinishTarget,
      cannotStart,
      isGiveUpRoulette,
      data,
      pickedSpins,
      nextSpinIndex,
    ],
  );

  const handleStopSpinning = useCallback(() => {
    if (skipInitiatedRef.current) {
      setIsSpinning(false);
      setCurrentSpinResult(null);
      return;
    }
    if (currentSpinResult) {
      setHistory((prev) => [...prev, currentSpinResult.penaltyContent]);
      if (manualSpinRef.current)
        setSpotlightLabel(currentSpinResult.penaltyContent);
    }
    manualSpinRef.current = false;
    setCurrentIndex((prev) => prev + 1);
    setIsSpinning(false);
    setCurrentSpinResult(null);
  }, [currentSpinResult]);

  // ── Exit/Skip handlers ──
  const handleExit = () => {
    data.exitMutation.mutate(undefined, {
      onSuccess: () => {
        setIsDialogOpen(false);
        moveToFinishTarget();
      },
      onError: (err) => {
        const msg = getAxiosMessage(err);
        if (
          axios.isAxiosError(err) &&
          (err.response?.status === 400 || err.response?.status === 409) &&
          msg?.includes('이미 완료')
        ) {
          setIsDialogOpen(false);
          moveToFinishTarget();
          return;
        }
        setIsDialogOpen(false);
        data.clearGuestSession();
        router.push('/');
      },
    });
  };

  const handleSkip = () => {
    skipInitiatedRef.current = true;
    data.skipMutation.mutate(undefined, {
      onSuccess: (res) => {
        const revealed = (
          (res as { revealedPenalties?: { count: number; content: string }[] })
            ?.revealedPenalties ?? []
        ).flatMap((p) => Array.from({ length: p.count }, () => p.content));
        setHistory(revealed);
        setCurrentSpinResult(null);
        setIsSpinning(false);
        setCurrentIndex(totalChances);
        toast.success('벌칙 결과를 모두 자동으로 뽑았어요');
      },
      onError: (err) => {
        const msg = getAxiosMessage(err);
        if (
          axios.isAxiosError(err) &&
          err.response?.status === 400 &&
          msg?.includes('이미 완료')
        ) {
          moveToFinishTarget();
          return;
        }
        skipInitiatedRef.current = false;
        toast.error('처리하지 못했어요. 잠시 후 다시 시도해주세요.');
      },
    });
  };

  // ── Effects ──
  // 스포트라이트 타이머
  useEffect(() => {
    if (!spotlightLabel) return;
    const id = setTimeout(() => setSpotlightLabel(null), SPOTLIGHT_DURATION_MS);
    return () => clearTimeout(id);
  }, [spotlightLabel]);

  // 완료 후 스크롤
  useEffect(() => {
    if (
      !isSpinning &&
      isAllCompleted &&
      history.length > 0 &&
      !spotlightLabel
    ) {
      const id = setTimeout(() => {
        const el = selectedPenaltyRef.current;
        if (!el) return;
        const headerH =
          document.querySelector('header')?.getBoundingClientRect().height ??
          58;
        const top =
          el.getBoundingClientRect().top + window.scrollY - headerH - 12;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }, 500);
      return () => clearTimeout(id);
    }
  }, [isSpinning, isAllCompleted, history.length, spotlightLabel]);

  // 자동추첨 시작 토스트
  useEffect(() => {
    if (!isAutoDraw) {
      autoDrawStartedRef.current = false;
      return;
    }
    if (autoDrawStartedRef.current) return;
    autoDrawStartedRef.current = true;
    toast.error('시간이 초과됐어요.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [isAutoDraw]);

  // 자동추첨 루프
  useEffect(() => {
    if (!isAutoDraw || isAllCompleted) return;
    if (
      isSpinning ||
      data.spinMutation.isPending ||
      data.skipMutation.isPending
    )
      return;
    if (isDialogOpen || data.exitMutation.isPending) return;
    const id = setTimeout(() => void handleStartSpinning(true), 150);
    return () => clearTimeout(id);
  }, [
    isAutoDraw,
    isAllCompleted,
    isSpinning,
    data.spinMutation.isPending,
    data.skipMutation.isPending,
    isDialogOpen,
    data.exitMutation.isPending,
    handleStartSpinning,
  ]);

  // 스킵 조건 (일반)
  useEffect(() => {
    if (isGiveUpRoulette || data.isResultLoading || !data.result) return;
    const shouldSkip =
      (isExpired && remainingChances <= 0) ||
      !data.hasRouletteItems ||
      (!!data.myResult && totalChances === 0);
    if (shouldSkip && !isSpinning && history.length === 0) moveToFinishTarget();
  }, [
    isGiveUpRoulette,
    data.isResultLoading,
    data.result,
    isExpired,
    remainingChances,
    data.hasRouletteItems,
    isSpinning,
    history.length,
    data.myResult,
    totalChances,
    moveToFinishTarget,
  ]);

  // 스킵 조건 (중도포기)
  useEffect(() => {
    if (!isGiveUpRoulette || data.isGiveUpResultLoading || !data.giveUpResult)
      return;
    if (!data.hasRouletteItems && !isSpinning && history.length === 0)
      moveToFinishTarget();
  }, [
    isGiveUpRoulette,
    data.isGiveUpResultLoading,
    data.giveUpResult,
    data.hasRouletteItems,
    isSpinning,
    history.length,
    moveToFinishTarget,
  ]);

  // 중도포기 벌칙 없음 체크
  useEffect(() => {
    if (
      !isGiveUpRoulette ||
      data.isGiveUpResultLoading ||
      data.isGiveUpResultError
    )
      return;
    if (data.giveUpResult && data.giveUpSpinResults.length === 0) {
      if (!hasShownNoPenaltyToastRef.current) {
        toast.info('받을 벌칙이 없어요.');
        hasShownNoPenaltyToastRef.current = true;
      }
      data.clearGuestSession();
      router.replace('/');
    }
  }, [data, isGiveUpRoulette, router]);

  // ── Error messages ──
  const errors: string[] = [];
  if (isGiveUpRoulette ? data.isGiveUpResultError : data.isResultError)
    errors.push('벌칙 목록을 찾지 못했어요.');
  if (
    !(isGiveUpRoulette ? data.isGiveUpResultLoading : data.isResultLoading) &&
    !data.hasRouletteItems
  )
    errors.push('벌칙 룰렛에 사용할 목록이 없어요.');
  if (!isGiveUpRoulette && !data.isResultLoading && !data.myResult)
    errors.push('벌칙 룰렛 정보를 찾을 수 없어요.');
  if (currentSpinResult && targetIndex < 0)
    errors.push('서버에서 받은 당첨 벌칙이 룰렛 목록에 없습니다.');
  if (spinErrorMessage) errors.push(spinErrorMessage);

  const buttonLabel = (
    isGiveUpRoulette ? data.isGiveUpResultLoading : data.isResultLoading
  )
    ? '벌칙 룰렛 준비 중...'
    : isAutoDraw
      ? `자동으로 결정 중... (${remainingChances}/${totalChances})`
      : data.spinMutation.isPending
        ? '결정된 벌칙 확인 중...'
        : isSpinning
          ? '벌칙 결정 중...'
          : isCompleted
            ? isGiveUpRoulette
              ? '홈으로 이동'
              : data.isSoloMember
                ? '수감 결과 확인하기'
                : '다른 수감자 벌칙 보기'
            : `벌칙 룰렛 돌리기 (${Math.max(0, remainingChances)}/${totalChances})`;

  return (
    <MobileLayout
      header={
        <div className='flex w-full items-center justify-between text-foreground'>
          <span className='mx-auto text-lg font-medium'>벌칙 룰렛</span>
          <CloseButton
            onClick={() =>
              isCompleted ? moveToFinishTarget() : setIsDialogOpen(true)
            }
            aria-label='룰렛 나가기'
          />
        </div>
      }
      bottomButton={
        <div className='flex w-full flex-row gap-2'>
          {skipVisibleNow && (
            <Button
              variant='secondary'
              size='main'
              className='flex-2 whitespace-nowrap rounded-[14px] px-2 font-bold'
              onClick={handleSkip}
              disabled={!canSkipNow}
            >
              {data.skipMutation.isPending ? '처리 중...' : '결과 바로보기'}
            </Button>
          )}
          <Button
            variant='default'
            size='main'
            className='flex-3 rounded-[14px] font-bold'
            onClick={() => handleStartSpinning()}
            disabled={
              isSpinning || ((cannotStart || isAutoDraw) && !isDrawDone)
            }
          >
            {buttonLabel}
          </Button>
        </div>
      }
    >
      <div className='flex min-w-0 flex-col gap-4 pb-6 text-foreground'>
        <RouletteTimer
          serverTime={
            isGiveUpRoulette
              ? data.giveUpResult?.serverTime
              : data.result?.serverTime
          }
          rouletteEndsAt={
            isGiveUpRoulette
              ? data.giveUpResult?.rouletteEndsAt
              : data.result?.rouletteEndsAt
          }
          dataUpdatedAt={
            isGiveUpRoulette ? data.giveUpDataUpdatedAt : data.dataUpdatedAt
          }
          isDrawDone={isDrawDone}
          isAutoDraw={isAutoDraw}
          onExpiredChange={setIsTimerExpired}
        />
        <RouletteWheel
          isSpinning={isSpinning}
          targetIndex={targetIndex}
          rouletteLabels={data.rouletteLabels}
          onStopSpinning={handleStopSpinning}
          isAutoDraw={isAutoDraw}
          isDrawDone={isDrawDone}
          errors={errors}
        />
        <RouletteHistory ref={selectedPenaltyRef} history={history} />
      </div>

      {/* Exit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>결정할 벌칙이 아직 남았어요.</DialogTitle>
            <DialogDescription>벌칙이 자동으로 결정돼요.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='secondary'
              onClick={() => setIsDialogOpen(false)}
              className='flex-1 h-12 rounded-lg'
            >
              취소
            </Button>
            <Button
              onClick={handleExit}
              disabled={data.exitMutation.isPending}
              className='flex-1 h-12 rounded-lg font-bold'
            >
              {data.exitMutation.isPending ? '처리 중...' : '나가기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spotlight */}
      {spotlightLabel && (
        <div
          aria-hidden
          className='pointer-events-none fixed inset-0 z-40'
          style={{ animation: 'spotlightIn 0.2s ease-out both' }}
        >
          <div
            className='absolute inset-0'
            style={{ background: 'rgba(0, 0, 0, 0.85)' }}
          />
          <div
            className='absolute inset-0'
            style={{
              clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
              background:
                'linear-gradient(to bottom, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.12) 50%, transparent 85%)',
            }}
          />
          <div className='absolute inset-0 z-10 flex flex-col items-center justify-center px-10 text-center'>
            <div className='flex flex-col items-center rounded-[14px] mb-2 bg-black/60 px-4 py-2 text-xs font-semibold text-white/70'>
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
      )}
    </MobileLayout>
  );
}
