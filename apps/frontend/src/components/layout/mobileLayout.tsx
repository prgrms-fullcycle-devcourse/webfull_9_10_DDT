import { ReactNode } from 'react';

interface MobileLayoutProps {
  header: ReactNode;
  children: ReactNode;
  bottomButton: ReactNode;
}

export const MobileLayout = ({ header, children, bottomButton }: MobileLayoutProps) => {
  return (
    <div className='relative flex flex-col min-h-screen'>
      {/* 상단 헤더 고정 */}
      <header className='fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] h-[58px] z-50 bg-background border-b border-border flex items-center px-4'>
        {header}
      </header>

      {/* 스크롤 가능한 콘텐츠 영역 */}
      <main className='flex-1 mt-[58px] mb-[80px] overflow-y-auto px-4 py-4'>
        {children}
      </main>

      {/* 하단 버튼 고정 */}
      <div className='fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] h-[80px] z-50 bg-background border-t border-border flex items-center px-4'>
        {bottomButton}
      </div>
    </div>
  );
};
