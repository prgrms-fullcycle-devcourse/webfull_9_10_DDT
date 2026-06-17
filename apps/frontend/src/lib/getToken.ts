/**
 * 쿠키에서 access_token 값을 읽어 반환한다. (서버 환경이거나 토큰이 없으면 null)
 *
 * @returns access_token 문자열, 없으면 null
 */
export function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/access_token=([^;]+)/);
  return match ? match[1] : null;
}
