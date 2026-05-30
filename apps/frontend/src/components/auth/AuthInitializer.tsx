'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const me = useAuthStore((s) => s.me);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    if (!me) {
      fetchMe();
    }
  }, [me, fetchMe]);

  return <>{children}</>;
}
