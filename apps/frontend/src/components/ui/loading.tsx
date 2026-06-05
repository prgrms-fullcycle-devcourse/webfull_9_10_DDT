'use client';

interface LoadingProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: {
    wrap: 'w-9 h-9',
    dot: 'w-[5px] h-[5px]',
    ripple: 'data-[ripple]:w-9 data-[ripple]:h-9',
    rippleStart: 'w-[5px] h-[5px]',
    rippleEnd: 'w-9 h-9',
  },
  md: {
    wrap: 'w-[60px] h-[60px]',
    dot: 'w-2 h-2',
    rippleStart: 'w-2 h-2',
    rippleEnd: 'w-[60px] h-[60px]',
  },
  lg: {
    wrap: 'w-20 h-20',
    dot: 'w-[10px] h-[10px]',
    rippleStart: 'w-[10px] h-[10px]',
    rippleEnd: 'w-20 h-20',
  },
};

function PingSpinner({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  const cfg = sizeConfig[size];

  return (
    <div className={`relative flex items-center justify-center ${cfg.wrap}`}>
      <span
        className={`
                    absolute rounded-full bg-white z-10
                    animate-[dotPulse_2s_ease-in-out_infinite]
                    ${cfg.dot}
                `}
      />
      {[0, 0.55, 1.1].map((delay, i) => (
        <span
          key={i}
          className='absolute rounded-full border border-white/70 animate-[rippleOut_2s_ease-out_infinite]'
          style={{ animationDelay: `${delay}s` }}
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
    <>
      {/* 키프레임 정의 */}
      <style>{`
                @keyframes dotPulse {
                    0%, 100% { transform: scale(1); opacity: 0.9; }
                    50%       { transform: scale(1.3); opacity: 1; }
                }
                @keyframes rippleOut {
                    0%   { width: 10px; height: 10px; opacity: 0.6; }
                    100% { width: 80px; height: 80px; opacity: 0; }
                }
                @keyframes textFade {
                    0%, 100% { opacity: 0.35; }
                    50%       { opacity: 0.75; }
                }
            `}</style>

      {/* dim 오버레이 — 뷰포트 전체를 덮어 인터랙션 차단 */}
      <div
        className='fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/60 backdrop-blur-sm'
        aria-live='polite'
        aria-label={label}
      >
        <PingSpinner size={size} />
        <span
          className='text-[13px] tracking-widest text-white/50 font-light'
          style={{ animation: 'textFade 2s ease-in-out infinite' }}
        >
          {label}
        </span>
      </div>
    </>
  );
}
