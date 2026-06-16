'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import Loading from '../ui/loading';

const AUTH_REQUIRED_TOAST_ID = 'auth-required';
const REDIRECT_DELAY_MS = 900;

interface RequireAuthProps {
  children: ReactNode;
  redirectTo?: string;
  message?: string;
  loadingVariant?: 'overlay' | 'contained';
}

export function RequireAuth({
  children,
  redirectTo = '/',
  message = '로그인하고 바로 이어가세요.',
  loadingVariant = 'overlay',
}: RequireAuthProps) {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();
  // 이번 마운트에서 로그인 상태였던 적이 있으면, 이후의 미로그인은 로그아웃으로 간주해
  // "로그인하고 바로 이어가세요" 토스트를 띄우지 않는다. (직접 URL 접근 시에만 안내)
  const wasLoggedInRef = useRef(false);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (isLoggedIn) {
      wasLoggedInRef.current = true;
      toast.dismiss(AUTH_REQUIRED_TOAST_ID);
      return;
    }

    if (!wasLoggedInRef.current) {
      toast.error(message, { id: AUTH_REQUIRED_TOAST_ID });
    }

    const redirectTimer = window.setTimeout(() => {
      router.replace(redirectTo);
    }, REDIRECT_DELAY_MS);

    return () => window.clearTimeout(redirectTimer);
  }, [isLoading, isLoggedIn, message, redirectTo, router]);

  if (isLoading || !isLoggedIn)
    return isLoading ? <Loading variant={loadingVariant} /> : null;

  return <>{children}</>;
}
