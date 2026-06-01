'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

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

const SERVER_ROULETTE_ITEMS: RoulettePenalty[] = [
  { id: '1', label: '팔굽혀펴기 50개' },
  { id: '2', label: '간식 참기 3시간' },
  { id: '3', label: '코드 리뷰하기' },
  { id: '4', label: '플랭크 30초' },
];

const SERVER_ANSWER_IDS = ['1', '3', '2'];
const SERVER_REMAINING_SECONDS = 521;
const TOTAL_CHANCES = SERVER_ANSWER_IDS.length;

const formatRemainingTime = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
};

export default function RoulettePage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const isAllCompleted = currentIndex >= TOTAL_CHANCES;
  const currentAnswerId = SERVER_ANSWER_IDS[currentIndex];
  const remainingTime = formatRemainingTime(SERVER_REMAINING_SECONDS);

  const rouletteLabels = useMemo(
    () => SERVER_ROULETTE_ITEMS.map((item) => item.label),
    [],
  );

  const targetIndex = useMemo(
    () =>
      SERVER_ROULETTE_ITEMS.findIndex((item) => item.id === currentAnswerId),
    [currentAnswerId],
  );

  const currentAnswer =
    targetIndex >= 0 ? SERVER_ROULETTE_ITEMS[targetIndex] : null;
  const hasInvalidTarget = !isAllCompleted && targetIndex < 0;

  const handleStartSpinning = () => {
    if (isAllCompleted) {
      router.push(`/room/${params.code}/result-After`);
      return;
    }

    if (hasInvalidTarget) return;
    setIsSpinning(true);
  };

  const handleStopSpinning = () => {
    if (currentAnswer) {
      setHistory((prev) => [...prev, currentAnswer.label]);
    }
    setCurrentIndex((prev) => prev + 1);
    setIsSpinning(false);
  };

  const handleExit = () => {
    setIsDialogOpen(false);
    console.log('룰렛 나가기');
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
          disabled={isSpinning || hasInvalidTarget}
        >
          {isSpinning
            ? '룰렛 돌리는 중...'
            : isAllCompleted
              ? '다른 멤버 벌칙 보기'
              : `룰렛 돌리기 (${TOTAL_CHANCES - currentIndex}/${TOTAL_CHANCES})`}
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
          {hasInvalidTarget ? (
            <p className='mt-4 text-sm text-destructive'>
              서버에서 받은 당첨 벌칙이 룰렛 목록에 없습니다.
            </p>
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
              className='h-14 rounded-[14px] bg-primary text-sm font-bold text-primary-foreground'
            >
              나가기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}
