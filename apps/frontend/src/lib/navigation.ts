const TOTAL_RESULT_FROM_KEY = 'totalResultFrom';

export type ResultFromSource = 'room' | 'mypage' | 'mypage-history';

/**
 * TotalResult 진입 경로를 sessionStorage에 저장합니다.
 * 결과 화면의 "돌아가기" 버튼 목적지를 결정하는 데 사용됩니다.
 *
 * @param from - 진입 출처 ('room': 룰렛 후, 'mypage': 마이페이지, 'mypage-history': 참여 기록)
 */
export const setResultFrom = (from: ResultFromSource) => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TOTAL_RESULT_FROM_KEY, from);
};

/**
 * 저장된 TotalResult 진입 경로를 반환합니다.
 * SSR 환경에서는 sessionStorage가 없으므로 null을 반환합니다.
 *
 * @returns 진입 출처 문자열 또는 null
 */
export const getResultFrom = () => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOTAL_RESULT_FROM_KEY);
};

/** 저장된 TotalResult 진입 경로를 삭제합니다. */
export const clearResultFrom = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOTAL_RESULT_FROM_KEY);
};

/**
 * 결과 화면에서 "돌아가기" 시 이동할 경로를 반환합니다.
 * sessionStorage에 저장된 진입 출처에 따라 분기합니다.
 *
 * @returns 이동할 경로 문자열 (기본값: '/')
 */
export const getCloseTarget = (): string => {
  const from = getResultFrom();
  if (from === 'mypage-history') return '/mypage/history';
  if (from === 'mypage') return '/mypage';
  return '/';
};
