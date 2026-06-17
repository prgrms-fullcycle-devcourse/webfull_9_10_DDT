import { useEffect, useState } from 'react';

/**
 * 초를 'MM:SS'로 포맷한다. 음수는 0으로 본다.
 *
 * @param totalSeconds - 남은 시간(초)
 * @returns 예: '01:30'
 */
export const formatRemainingTime = (totalSeconds: number) => {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/**
 * 종료 시각까지 남은 초를 서버 시계 기준으로 계산한다.
 * serverTime을 받은 이후 흐른 시간(now - dataUpdatedAt)을 더해 서버의 현재 시각을 추정하므로,
 * 클라이언트 시계가 어긋나 있어도 정확하다.
 *
 * @param serverTime - 응답에 담긴 서버 시각(ISO)
 * @param rouletteEndsAt - 룰렛 종료 시각(ISO), null이면 0
 * @param dataUpdatedAt - serverTime을 받은 클라이언트 시각(ms)
 * @param now - 현재 클라이언트 시각(ms)
 * @returns 남은 초 (최소 0)
 */
export const getRemainingSeconds = (
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

/**
 * 1초마다 갱신되는 룰렛 카운트다운 훅. 서버 시계 기준 남은 시간과 만료 여부를 반환한다.
 *
 * @param serverTime - 서버 시각(ISO). 없으면 비활성(0)
 * @param rouletteEndsAt - 룰렛 종료 시각(ISO)
 * @param dataUpdatedAt - serverTime을 받은 클라이언트 시각(ms)
 * @returns now·remainingSeconds·remainingTime('MM:SS')·isExpired
 */
export function useRouletteTimer(
  serverTime: string | undefined,
  rouletteEndsAt: string | null | undefined,
  dataUpdatedAt: number,
) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingSeconds = serverTime
    ? getRemainingSeconds(
        serverTime,
        rouletteEndsAt ?? null,
        dataUpdatedAt,
        now,
      )
    : 0;

  return {
    now,
    remainingSeconds,
    remainingTime: formatRemainingTime(remainingSeconds),
    isExpired: !!serverTime && remainingSeconds <= 0,
  };
}
