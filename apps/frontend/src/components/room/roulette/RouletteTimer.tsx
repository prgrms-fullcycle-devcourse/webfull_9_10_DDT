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

/**
 * 룰렛 제한 시간 카운트다운 표시. 상태에 따라 남은 시간 / 자동 결정 안내 / 완료 문구를 보여준다.
 * 만료 여부가 바뀌면 onExpiredChange로 부모(로직 훅)에 알려 자동 뽑기 등을 트리거하게 한다.
 *
 * @param serverTime - 서버 기준 현재 시각 (시계 보정 기준)
 * @param rouletteEndsAt - 룰렛 종료 시각 (null이면 카운트다운 없음)
 * @param dataUpdatedAt - serverTime을 받은 클라이언트 시각 (경과 보정용)
 * @param isDrawDone - 모든 벌칙을 다 뽑았는지
 * @param isAutoDraw - 시간 초과로 자동 결정 중인지
 * @param onExpiredChange - 만료 상태 변경 콜백
 */
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
    <div className='rounded-[14px] border border-(--roulette-panel-border) bg-(--roulette-panel) p-4 text-center'>
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
