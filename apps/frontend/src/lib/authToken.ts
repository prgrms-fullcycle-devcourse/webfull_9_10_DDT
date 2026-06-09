import { jwtDecode } from 'jwt-decode';
import { getToken } from '@/lib/getToken';

type JwtPayload = {
  role?: string;
};

export const clearAccessTokenCookie = () => {
  document.cookie =
    'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
};

export const isGuestAccessToken = () => {
  const token = getToken();
  if (!token) return false;

  try {
    return jwtDecode<JwtPayload>(token).role === 'guest';
  } catch {
    return false;
  }
};

export const clearGuestAccessToken = () => {
  if (!isGuestAccessToken()) {
    return false;
  }

  clearAccessTokenCookie();
  return true;
};
