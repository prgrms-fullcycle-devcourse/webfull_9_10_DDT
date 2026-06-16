const TOTAL_RESULT_FROM_KEY = 'totalResultFrom';

export type ResultFromSource = 'room' | 'mypage' | 'mypage-history';

export const setResultFrom = (from: ResultFromSource) =>
  sessionStorage.setItem(TOTAL_RESULT_FROM_KEY, from);

export const getResultFrom = () =>
  sessionStorage.getItem(TOTAL_RESULT_FROM_KEY);

export const clearResultFrom = () =>
  sessionStorage.removeItem(TOTAL_RESULT_FROM_KEY);

export const getCloseTarget = (): string => {
  const from = getResultFrom();
  if (from === 'mypage-history') return '/mypage/history';
  if (from === 'mypage') return '/mypage';
  return '/';
};
