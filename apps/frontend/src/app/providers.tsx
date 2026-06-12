'use client';

import { useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { OAuthMessageHandler } from '@/components/auth/OAuthMessageHandler';
import { AuthPrefetch } from '@/components/auth/AuthPrefetch';
import { ServiceWorkerRegister } from '@/components/auth/ServiceWorkerRegister';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleToastClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const toastEl = target.closest('[data-sonner-toast]');
      if (toastEl) {
        toast.dismiss();
      }
    };

    window.addEventListener('click', handleToastClick);
    return () => window.removeEventListener('click', handleToastClick);
  }, []);

  return (
    <QueryProvider>
      <ServiceWorkerRegister />
      <OAuthMessageHandler />
      <AuthPrefetch />
      {children}
      <Toaster position='top-center' richColors />
    </QueryProvider>
  );
}