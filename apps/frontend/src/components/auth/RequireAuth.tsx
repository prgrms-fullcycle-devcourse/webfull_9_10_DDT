'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';

const AUTH_REQUIRED_TOAST_ID = 'auth-required';
const REDIRECT_DELAY_MS = 900;

interface RequireAuthProps {
  children: ReactNode;
  redirectTo?: string;
  message?: string;
}

export function RequireAuth({
  children,
  redirectTo = '/',
  message = '로그인하고 바로 이어가세요.',
}: RequireAuthProps) {
  const router = useRouter();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const checkLoginStatus = useAuthStore((state) => state.checkLoginStatus);

  useEffect(() => {
    const hasToken = checkLoginStatus();

    if (!hasToken) {
      toast.error(message, { id: AUTH_REQUIRED_TOAST_ID });

      const redirectTimer = window.setTimeout(() => {
        router.replace(redirectTo);
      }, REDIRECT_DELAY_MS);

      return () => window.clearTimeout(redirectTimer);
    }
  }, [checkLoginStatus, message, redirectTo, router]);

  if (!isLoggedIn) {
    return null;
  }

  return <>{children}</>;
}
