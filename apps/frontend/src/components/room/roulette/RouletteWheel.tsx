'use client';
import dynamic from 'next/dynamic';

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
