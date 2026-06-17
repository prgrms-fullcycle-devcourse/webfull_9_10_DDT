import React from 'react';

interface SpotlightOverlayProps {
  label: string;
}

/**
 * 벌칙이 확정된 순간 화면 전체를 어둡게 덮고 스포트라이트 연출로 당첨 벌칙명을 강조하는 오버레이.
 * 시각 효과 전용이라 포인터 이벤트를 받지 않는다(pointer-events-none).
 *
 * @param label - 강조해 보여줄 확정 벌칙명
 */
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
