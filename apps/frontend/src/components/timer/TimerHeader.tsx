'use client';

import { HeaderTitle } from '@/components/layout/HeaderTitle';

interface TimerHeaderProps {
  isFocus: boolean;
  round: number;
  totalRounds: number;
}

/**
 * 타이머 화면 헤더. 현재 상태(집중/휴식)와 진행 회차(round / 총 회차)를 표시한다.
 *
 * @param isFocus - 집중 시간이면 true, 휴식 시간이면 false
 * @param round - 현재 회차 (1부터)
 * @param totalRounds - 총 회차
 */
export function TimerHeader({ isFocus, round, totalRounds }: TimerHeaderProps) {
  const textColor = isFocus ? '' : 'text-success';
  const statusText = isFocus ? '집중 시간' : '휴식 시간';
  // 휴식은 회차 사이에만 있으므로 분모를 (총 회차 - 1)로 표기한다. (집중은 총 회차 그대로)
  const displayRounds = isFocus ? totalRounds : Math.max(0, totalRounds - 1);

  return (
    <HeaderTitle align='center' className={textColor}>
      {statusText} {round} / {displayRounds}
    </HeaderTitle>
  );
}
