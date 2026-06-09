import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import { Providers } from './providers'; 

const notoSansKR = Noto_Sans_KR({
  variable: '--font-noto-sans-kr',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: '감옥 - 디지털 디톡스 타이머',
  description: '남들이 딴짓할 때, 우리는 서로를 가두고 집중합니다. 가장 효율적인 디지털 디톡스 타이머.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='ko' className={`${notoSansKR.variable} h-full antialiased dark`}>
      <body className='min-h-full flex justify-center bg-zinc-500'>
        <Providers>
          <div className='relative w-full max-w-97.5 min-h-screen flex flex-col bg-background sm:border-x sm:border-border sm:shadow-[0_0_40px_rgba(0,0,0,0.6)]'>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}