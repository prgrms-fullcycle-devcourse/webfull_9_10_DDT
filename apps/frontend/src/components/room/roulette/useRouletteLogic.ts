import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'sonner';
import {
  getAxiosMessage,
  getUnrevealedPenaltyCount,
  useRouletteData,
} from './useRouletteData';
import { setResultFrom } from '@/lib/navigation';

const SKIP_THRESHOLD = 5;
const SPOTLIGHT_DURATION_MS = 2400;

/**
 * 룰렛 화면의 모든 UI 상태·흐름을 관리하는 핸들러 훅. (데이터 계층은 useRouletteData)
 * 스핀 시작/정지·확정 내역 누적·스포트라이트·스킵(결과 바로보기)·시간 초과 자동 결정·나가기·완료 후 이동을 처리한다.
 * 화면(Roulette)은 여기서 반환하는 data·state·actions·selectedPenaltyRef만 사용한다.
 *
 * @param code - 방 코드
 * @param isGiveUpRoulette - 중도 포기자 전용 룰렛 여부
 * @returns data(데이터 계층)·state(파생 상태)·actions(핸들러)·selectedPenaltyRef(확정 내역 스크롤 ref)
 */
export function useRouletteLogic(code: string, isGiveUpRoulette: boolean) {
  const router = useRouter();
  const finishTarget = isGiveUpRoulette ? '/' : `/room/${code}/total-result`;

  const data = useRouletteData(code, isGiveUpRoulette);

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
  // 총 뽑기 횟수: 포기자는 미리 만든 스핀 목록 길이, 일반은 미공개 벌칙 수.
  // 이미 뽑은 수(pickedSpins)와 남은 수(remainingChances)를 여기서 산출한다.
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
  // isDrawDone: 완료 + 휠이 멈춘 상태(문구 전환용). isAutoDraw: 시간 초과인데 아직 남은 벌칙이 있어 자동으로 돌려야 하는 상태.
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
      setResultFrom('room');
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
          if (!spinResult)
            setSpinErrorMessage('벌칙 룰렛 결과를 찾을 수 없어요.');
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
        // document.querySelector 대신 60(모바일 레이아웃 기본 헤더 높이) 사용
        const headerH = 60;
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

  return {
    data,
    state: {
      isSpinning,
      history,
      isDialogOpen,
      spotlightLabel,
      totalChances,
      remainingChances,
      isCompleted,
      isDrawDone,
      isAutoDraw,
      skipVisibleNow,
      canSkipNow,
      targetIndex,
      cannotStart,
      errors,
      buttonLabel,
    },
    actions: {
      setIsDialogOpen,
      setIsTimerExpired,
      handleStartSpinning,
      handleStopSpinning,
      handleExit,
      handleSkip,
      moveToFinishTarget,
    },
    selectedPenaltyRef,
  };
}
