'use client';
import dynamic from 'next/dynamic';

// 룰렛 휠은 canvas·window에 의존하므로 ssr:false로 클라이언트에서만 로드한다. (로딩 중엔 빈 원 표시)
const PenaltyRoulette = dynamic(
  () => import('@/components/ui/custom-roulette'),
  {
    ssr: false,
    loading: () => (
      <div className='mx-auto aspect-square w-full max-w-[320px] rounded-full border-2 border-[var(--roulette-panel-border)] bg-[var(--roulette-wheel-center)]' />
    ),
  },
);

interface RouletteWheelProps {
  isSpinning: boolean;
  targetIndex: number;
  rouletteLabels: string[];
  onStopSpinning: () => void;
  isAutoDraw: boolean;
  isDrawDone: boolean;
  errors: string[];
}

/**
 * 벌칙 룰렛 휠 카드. 동적 로드된 PenaltyRoulette를 감싸 라벨·당첨 인덱스·스핀 제어를 넘기고 에러를 표시한다.
 * 자동 결정(isAutoDraw) 시에는 스핀을 매우 빠르게 돌린다.
 *
 * @param isSpinning - 스핀 시작 여부
 * @param targetIndex - 당첨 칸 인덱스
 * @param rouletteLabels - 휠에 표시할 벌칙명 목록
 * @param onStopSpinning - 스핀 정지 콜백
 * @param isAutoDraw - 시간 초과 자동 결정 여부 (스핀 속도 가속)
 * @param isDrawDone - 모든 벌칙 결정 완료 여부
 * @param errors - 표시할 에러 메시지 목록
 */
export function RouletteWheel({
  isSpinning,
  targetIndex,
  rouletteLabels,
  onStopSpinning,
  isAutoDraw,
  isDrawDone,
  errors,
}: RouletteWheelProps) {
  return (
    <div className='flex w-full min-w-0 flex-col items-center rounded-[14px] border border-[var(--roulette-card-border)] bg-[var(--roulette-card)] px-4 py-6'>
      <h2 className='mb-6 text-lg font-bold'>오늘의 벌칙 뽑기</h2>
      <PenaltyRoulette
        mustStartSpinning={isSpinning}
        targetIndex={targetIndex}
        onStopSpinning={onStopSpinning}
        items={rouletteLabels}
        spinDuration={isAutoDraw ? 0.1 : undefined}
        isDrawDone={isDrawDone}
      />
      {errors.map((err, i) => (
        <p key={i} className='mt-4 text-sm text-destructive'>
          {err}
        </p>
      ))}
    </div>
  );
}
