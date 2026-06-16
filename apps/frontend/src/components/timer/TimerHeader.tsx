'use client';

import { HeaderTitle } from '@/components/layout/HeaderTitle';

interface TimerHeaderProps {
  isFocus: boolean;
  round: number;
  totalRounds: number;
}

export function TimerHeader({ isFocus, round, totalRounds }: TimerHeaderProps) {
  const textColor = isFocus ? '' : 'text-success';
  const statusText = isFocus ? '집중 시간' : '휴식 시간';
  const displayRounds = isFocus ? totalRounds : Math.max(0, totalRounds - 1);

  return (
    <HeaderTitle align='center' className={textColor}>
      {statusText} {round} / {displayRounds}
    </HeaderTitle>
  );
}
