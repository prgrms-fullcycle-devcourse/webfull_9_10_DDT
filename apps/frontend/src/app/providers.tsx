'use client';

import { Toaster } from 'sonner';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { OAuthMessageHandler } from '@/components/auth/OAuthMessageHandler';
import { AuthPrefetch } from '@/components/auth/AuthPrefetch';
import { ServiceWorkerRegister } from '@/components/auth/ServiceWorkerRegister';

export function Providers({ children }: { children: React.ReactNode }) {
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