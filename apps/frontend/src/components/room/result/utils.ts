import type { ResultMember } from './types';

/**
 * 밀리초 단위의 세션 시간을 "X시간 Y분" 형식으로 변환합니다.
 *
 * @param totalMs - 총 세션 시간 (밀리초). null이면 '-' 반환
 * @returns 포맷된 시간 문자열
 */
export const formatSessionTime = (totalMs: number | null): string => {
  if (totalMs === null) return '-';
  const totalMinutes = Math.floor(totalMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}분`;
  if (minutes <= 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
};

/**
 * 밀리초 단위의 이탈 시간을 사람이 읽기 쉬운 형식으로 변환합니다.
 * 1시간 이상이면 "X시간 Y분 ZZ초", 1분 미만이면 "Z초", 그 외 "Y분 ZZ초".
 * 음수나 NaN은 0으로 방어됩니다.
 *
 * @param totalMs - 총 이탈 시간 (밀리초)
 * @returns 포맷된 시간 문자열
 */
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

/**
 * 벌칙 강도 범위를 "X ~ Y%" 형식으로 변환합니다.
 * maxPct가 null이면 최상위 등급으로 "X% ~" 형식입니다.
 *
 * @param minPct - 시작 퍼센트
 * @param maxPct - 종료 퍼센트. null이면 상한 없음 (최상위 등급)
 * @returns 포맷된 범위 문자열
 */
export const formatTierRange = (
  minPct: number,
  maxPct: number | null,
): string => (maxPct === null ? `${minPct}% ~` : `${minPct} ~ ${maxPct}%`);

/**
 * 아직 룰렛에서 공개되지 않은 벌칙 수를 계산합니다.
 * 결과 화면에서 "벌칙 결정 중" 표시 여부를 판단하는 데 사용됩니다.
 *
 * @param member - 결과 멤버 객체
 * @returns 미공개 벌칙 수 (0 이상)
 */
export const getUnknownPenaltyCount = (member: ResultMember): number =>
  Math.max(0, member.penalties.totalCount - member.penaltyCount);
