'use client';

import type { CSSProperties } from 'react';

interface LoadingProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: { wrap: 'w-9 h-9', dot: 'w-[5px] h-[5px]', rippleStart: '5px', rippleEnd: '36px' },
  md: { wrap: 'w-[60px] h-[60px]', dot: 'w-2 h-2', rippleStart: '8px', rippleEnd: '60px' },
  lg: { wrap: 'w-20 h-20', dot: 'w-[10px] h-[10px]', rippleStart: '10px', rippleEnd: '80px' },
};

function PingSpinner({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  const cfg = sizeConfig[size];

  return (
    <div className={`relative flex items-center justify-center ${cfg.wrap}`}>
      <span
        className={`absolute rounded-full bg-white z-10 animate-[dotPulse_2s_ease-in-out_infinite] ${cfg.dot}`}
      />
      {[0, 0.55, 1.1].map((delay, i) => (
        <span
          key={i}
          className='absolute rounded-full border border-white/70 animate-[rippleOut_2s_ease-out_infinite]'
          style={
            {
              animationDelay: `${delay}s`,
              '--ripple-start': cfg.rippleStart,
              '--ripple-end': cfg.rippleEnd,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default function Loading({
  label = '불러오는 중...',
  size = 'lg',
}: LoadingProps) {
  return (
    <div
      className='fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/60 backdrop-blur-sm'
      aria-live='polite'
      aria-label={label}
    >
      <PingSpinner size={size} />
      <span className='text-[13px] tracking-widest text-white/50 font-light animate-[textFade_2s_ease-in-out_infinite]'>
        {label}
      </span>
    </div>
  );
}
