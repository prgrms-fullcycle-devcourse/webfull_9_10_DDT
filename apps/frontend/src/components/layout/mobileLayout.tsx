import { ReactNode } from 'react';

interface MobileLayoutProps {
  header: ReactNode;
  children: ReactNode;
  bottomButton?: ReactNode;
}

export const MobileLayout = ({
  header,
  children,
  bottomButton,
}: MobileLayoutProps) => {
  return (
    <div className='relative flex min-h-screen flex-col overflow-x-hidden'>
      {/* sticky: 부모 컨테이너 흐름 안에 있어, 모달 열림 시 스크롤바 변화로 헤더가 틀어지지 않는다 */}
      <header className='sticky top-0 z-50 flex h-[58px] shrink-0 items-center border-b border-border bg-background px-4'>
        {header}
      </header>

      <main className='flex-1 overflow-x-hidden px-4 py-4'>{children}</main>

      {bottomButton ? (
        <div className='sticky bottom-0 z-50 flex h-[80px] shrink-0 items-center border-t border-border bg-background px-4'>
          {bottomButton}
        </div>
      ) : null}
    </div>
  );
};
