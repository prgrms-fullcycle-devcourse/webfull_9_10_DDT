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
      <header className='fixed top-0 left-1/2 z-50 flex h-[58px] w-full max-w-[390px] -translate-x-1/2 items-center border-b border-border bg-background px-4'>
        {header}
      </header>

      <main
        className={`mt-[58px] flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 ${
          bottomButton ? 'mb-[80px]' : ''
        }`}
      >
        {children}
      </main>

      {bottomButton ? (
        <div className='fixed bottom-0 left-1/2 z-50 flex h-[80px] w-full max-w-[390px] -translate-x-1/2 items-center border-t border-border bg-background px-4'>
          {bottomButton}
        </div>
      ) : null}
    </div>
  );
};
