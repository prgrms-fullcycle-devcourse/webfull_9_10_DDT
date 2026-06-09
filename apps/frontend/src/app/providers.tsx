'use client';

import { Toaster } from 'sonner';
import { SessionRestorer } from '@/components/room/SessionRestorer';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { OAuthMessageHandler } from '@/components/auth/OAuthMessageHandler';
import { AuthPrefetch } from '@/components/auth/AuthPrefetch';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <OAuthMessageHandler />
      <SessionRestorer />
      <AuthPrefetch />
      {children}
      <Toaster position='top-center' richColors />
    </QueryProvider>
  );
}