'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getToken } from '@/lib/getToken';
import { getUsers } from '@/api/generated/users-사용자/users-사용자';
import { queryKeys } from '@/lib/queryKeys';
import { clearAccessTokenCookie } from '@/lib/authToken';

interface JwtPayload {
  sub: string;
  role: string;
  exp?: number;
}

interface Me {
  id: string;
  nickname: string;
  profileImage: string;
  role: 'user' | 'guest';
}

async function fetchMe(): Promise<Me | null> {
  const token = getToken();
  if (!token) return null;

  let payload: JwtPayload;
  try {
    payload = jwtDecode<JwtPayload>(token);
  } catch {
    return null;
  }

  // 게스트: API 호출 없이 payload에서 구성
  if (payload.role === 'guest') {
    return {
      id: payload.sub,
      nickname: '게스트',
      profileImage: 'basic_image_key_01',
      role: 'guest',
    };
  }

  // 로그인 유저: API 호출
  try {
    const res = await getUsers().usersControllerGetMe();
    const data = res.data as {
      userId: string;
      nickname: string;
      email: string;
      profileImage: string;
    };
    return {
      id: data.userId,
      nickname: data.nickname,
      profileImage: data.profileImage,
      role: 'user',
    };
  } catch {
    return null; // 토큰 만료 등
  }
}

/**
 * 현재 로그인 사용자(me)를 조회하고 로그인 상태·로그아웃·갱신을 제공하는 훅.
 * 게스트는 토큰 payload로 즉시 구성하고, 회원은 /users/me API로 조회한다. (React Query로 캐시)
 *
 * @returns `me` - 현재 사용자 정보 (없으면 null)
 * @returns `isLoggedIn` - 로그인 여부
 * @returns `isLoading` - me 조회 로딩 여부
 * @returns `logout` - 토큰 쿠키 제거 + me 캐시 초기화
 * @returns `refetchMe` - me 쿼리를 무효화해 다시 불러오기 (로그인/프로필 변경 후 호출)
 */
export function useAuth() {
  const queryClient = useQueryClient();

  const { data: me, isLoading } = useQuery<Me | null>({
    queryKey: queryKeys.auth.me(),
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: 'always',
  });

  const logout = useCallback(() => {
    clearAccessTokenCookie();
    queryClient.setQueryData(queryKeys.auth.me(), null);
  }, [queryClient]);

  const refetchMe = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
  }, [queryClient]);

  return {
    me: me ?? null,
    isLoggedIn: !!me,
    isLoading,
    logout,
    refetchMe,
  };
}
