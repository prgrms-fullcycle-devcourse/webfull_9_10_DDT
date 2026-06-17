/**
 * 밀리초를 "N시간 N분 N초" 형태의 한국어 문자열로 변환한다. (0인 단위는 생략, 전부 0이면 '0초')
 *
 * @param milliseconds - 변환할 시간(ms). 음수는 0으로 처리
 * @returns 예: '1시간 5분', '3분 02초', '0초'
 */
export const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // 0이 아닌 단위만 조합한다. (1분 미만의 이탈도 '초'로 드러나 색 판정과 일치)
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}초`);
  return parts.join(' ');
};

/**
 * 날짜를 'YYYY.MM.DD' 형식으로 변환한다. 유효하지 않은 값이면 원본을 문자열로 반환한다.
 *
 * @param value - Date 객체 또는 날짜 문자열
 * @returns 예: '2026.06.17'
 */
export const formatDateWithDots = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};
