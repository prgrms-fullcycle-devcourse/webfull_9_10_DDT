import React from 'react';

interface SpotlightOverlayProps {
  label: string;
}

export function SpotlightOverlay({ label }: SpotlightOverlayProps) {
  return (
    <div
      aria-hidden
      className='pointer-events-none fixed inset-0 z-40'
      style={{ animation: 'spotlightIn 0.2s ease-out both' }}
    >
      <div
        className='absolute inset-0'
        style={{ background: 'rgba(0, 0, 0, 0.85)' }}
      />
      <div
        className='absolute inset-0'
        style={{
          clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
          background:
            'linear-gradient(to bottom, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.12) 50%, transparent 85%)',
        }}
      />
      <div className='absolute inset-0 z-10 flex flex-col items-center justify-center px-10 text-center'>
        <div className='flex flex-col items-center rounded-[14px] mb-2 bg-black/60 px-4 py-2 text-xs font-semibold text-white/70'>
          벌칙 확정
        </div>
        <span
          className='text-2xl font-extrabold text-white'
          style={{
            textShadow:
              '0 0 12px rgba(255,255,255,0.7), 0 0 32px rgba(255,255,255,0.4)',
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
