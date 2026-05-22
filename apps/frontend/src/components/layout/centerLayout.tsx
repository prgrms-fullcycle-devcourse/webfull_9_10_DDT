import { ReactNode } from 'react';

interface FullscreenCenterLayoutProps {
  children: ReactNode;
  bgImage?: string;
  maxWidthClass?: string;
}

export const CenterLayout = ({
  children,
  bgImage = '/images/bgMain.webp',
  maxWidthClass = 'md:max-w-2xl',
}: FullscreenCenterLayoutProps) => {
  return (
    <div className='relative min-h-screen w-full flex flex-col items-center justify-center p-6 text-white'>
      <div
        className='absolute inset-0 bg-cover bg-center bg-no-repeat -z-10'
        style={{ backgroundImage: `url('${bgImage}')` }}
      />
      <div className='absolute inset-0 bg-black/60 -z-10' />

      <div className={`flex flex-col w-full max-w-xs gap-8 md:gap-12 ${maxWidthClass}`}>
        {children}
      </div>
    </div>
  );
};