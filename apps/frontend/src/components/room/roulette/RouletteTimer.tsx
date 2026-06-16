import { useEffect } from 'react';
import { useRouletteTimer } from './useRouletteTimer';

interface RouletteTimerProps {
  serverTime: string | undefined;
  rouletteEndsAt: string | null | undefined;
  dataUpdatedAt: number;
  isDrawDone: boolean;
  isAutoDraw: boolean;
  onExpiredChange: (isExpired: boolean) => void;
}

export function RouletteTimer({
  serverTime,
  rouletteEndsAt,
  dataUpdatedAt,
  isDrawDone,
  isAutoDraw,
  onExpiredChange,
}: RouletteTimerProps) {
  const { remainingTime, isExpired } = useRouletteTimer(
    serverTime,
    rouletteEndsAt,
    dataUpdatedAt,
  );

  useEffect(() => {
    onExpiredChange(isExpired);
  }, [isExpired, onExpiredChange]);

  return (
    <div className='rounded-[14px] border border-[var(--roulette-panel-border)] bg-[var(--roulette-panel)] p-4 text-center'>
      {isDrawDone ? (
        <div className='text-sm font-bold text-foreground'>
          벌칙을 다 뽑았어요.
        </div>
      ) : isAutoDraw ? (
        <div className='text-sm font-bold text-foreground'>
          시간이 초과되어 벌칙이 자동으로 결정돼요.
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
  );
}
