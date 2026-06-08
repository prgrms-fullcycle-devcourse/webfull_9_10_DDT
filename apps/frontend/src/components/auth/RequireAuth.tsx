'use client';

import { useEffect, type ReactNode } from 'react';
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
}

export function RequireAuth({
  children,
  redirectTo = '/',
  message = '로그인하고 바로 이어가세요.',
}: RequireAuthProps) {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (isLoggedIn) {
      toast.dismiss(AUTH_REQUIRED_TOAST_ID);
      return;
    }

    toast.error(message, { id: AUTH_REQUIRED_TOAST_ID });

    const redirectTimer = window.setTimeout(() => {
      router.replace(redirectTo);
    }, REDIRECT_DELAY_MS);

    return () => window.clearTimeout(redirectTimer);
  }, [isLoading, isLoggedIn, message, redirectTo, router]);

  if (isLoading || !isLoggedIn) return isLoading ? <Loading /> : null;

  return <>{children}</>;
}
