'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getToken } from '@/lib/getToken';
import { getUsers } from '@/api/generated/users-사용자/users-사용자';
import { queryKeys } from '@/lib/queryKeys';

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
    document.cookie =
      'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
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
