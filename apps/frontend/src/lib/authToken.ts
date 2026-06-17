import { jwtDecode } from 'jwt-decode';
import { getToken } from '@/lib/getToken';

const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24;

type JwtPayload = {
  role?: string;
};

/** access_token 쿠키를 만료시켜 제거한다. (로그아웃·게스트 정리 등에서 사용) */
export const clearAccessTokenCookie = () => {
  document.cookie =
    'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
};

/**
 * 현재 토큰이 게스트 토큰인지 판별한다. (JWT role === 'guest')
 *
 * @returns 게스트면 true, 토큰이 없거나 디코딩 실패 시 false
 */
export const isGuestAccessToken = () => {
  const token = getToken();
  if (!token) return false;

  try {
    return jwtDecode<JwtPayload>(token).role === 'guest';
  } catch {
    return false;
  }
};

/**
 * 게스트 토큰일 때만 쿠키를 제거한다. (회원 토큰은 건드리지 않음)
 *
 * @returns 게스트 토큰이라 제거했으면 true, 아니면 false
 */
export const clearGuestAccessToken = () => {
  if (!isGuestAccessToken()) {
    return false;
  }

  clearAccessTokenCookie();
  return true;
};

/**
 * access_token 쿠키를 설정한다. (max-age 24시간)
 *
 * @param token - 저장할 access token 문자열
 */
export const setAccessTokenCookie = (token: string) => {
  document.cookie = `access_token=${token}; path=/; max-age=${ACCESS_TOKEN_MAX_AGE}`;
};
