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
  const totalSeconds = Math.floor(totalMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}분 ${seconds.toString().padStart(2, '0')}초`;
};

export const formatTierRange = (
  minPct: number,
  maxPct: number | null,
): string => (maxPct === null ? `${minPct}% ~` : `${minPct} ~ ${maxPct}%`);

export const getUnknownPenaltyCount = (member: ResultMember): number =>
  Math.max(0, member.penalties.totalCount - member.penaltyCount);

export const getMemberLabel = (
  nickname: string,
  options: { isMe: boolean; isHost: boolean; isSolo: boolean },
): string => {
  const tags: string[] = [];
  if (options.isMe && !options.isSolo) tags.push('나');
  if (options.isHost) tags.push('방장');
  return tags.length > 0 ? `${nickname} (${tags.join(', ')})` : nickname;
};
