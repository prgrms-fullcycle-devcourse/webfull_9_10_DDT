import { useEffect, useState } from 'react';

export const formatRemainingTime = (totalSeconds: number) => {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

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
