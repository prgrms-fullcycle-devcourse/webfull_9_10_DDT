import type { Metadata, Viewport } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import { Toaster } from 'sonner';
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

export const viewport: Viewport = {
  themeColor: '#050816',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'DDT - 디지털 디톡스 타이머',
  description: '남들이 딴짓할 때, 우리는 서로를 가두고 집중한다.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DDT',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
