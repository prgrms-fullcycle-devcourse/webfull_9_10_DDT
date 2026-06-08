'use client';

import type { Metadata, Viewport } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import { Toaster } from 'sonner';
import { useEffect } from 'react';
import './globals.css';
import { SessionRestorer } from '@/components/room/SessionRestorer';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { OAuthMessageHandler } from '@/components/auth/OAuthMessageHandler';
import { AuthPrefetch } from '@/components/auth/AuthPrefetch';


const notoSansKR = Noto_Sans_KR({
  variable: '--font-noto-sans-kr',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('서비스 워커 등록 성공:', reg))
        .catch((err) => console.error('서비스 워커 등록 실패:', err));
    }
  }, []);

  return (
    <html
      lang='ko'
      className={`${notoSansKR.variable} h-full antialiased dark`}
    >
      <body className='min-h-full flex justify-center bg-zinc-500'>
        <QueryProvider>
          <OAuthMessageHandler />
          <SessionRestorer />
          <AuthPrefetch />
          <div className='relative w-full max-w-97.5 min-h-screen flex flex-col bg-background sm:border-x sm:border-border sm:shadow-[0_0_40px_rgba(0,0,0,0.6)]'>
            {children}
          </div>
          <Toaster position='top-center' richColors />
        </QueryProvider>
      </body>
    </html>
  );
}