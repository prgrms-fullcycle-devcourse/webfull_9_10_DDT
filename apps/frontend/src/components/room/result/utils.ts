import type { ResultMember } from './types';

export const formatSessionTime = (totalMs: number | null): string => {
  if (totalMs === null) return '-';
  const totalMinutes = Math.floor(totalMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}분`;
  if (minutes <= 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
};

export const formatEscapeTime = (totalMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000)); // 음수/NaN 방어
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = seconds.toString().padStart(2, '0');
  // 1시간 이상이면 시 단위까지 표기 (분이 무한정 커지지 않도록)
  if (hours > 0) return `${hours}시간 ${minutes}분 ${ss}초`;
  // 60초 미만이면 "0분"을 숨기고 초만 표기
  if (minutes === 0) return `${seconds}초`;
  return `${minutes}분 ${ss}초`;
};

export const formatTierRange = (
  minPct: number,
  maxPct: number | null,
): string => (maxPct === null ? `${minPct}% ~` : `${minPct} ~ ${maxPct}%`);

export const getUnknownPenaltyCount = (member: ResultMember): number =>
  Math.max(0, member.penalties.totalCount - member.penaltyCount);
