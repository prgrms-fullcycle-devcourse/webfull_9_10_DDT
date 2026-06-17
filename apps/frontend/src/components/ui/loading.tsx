'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';

interface LoadingProps {
  label?: string;
  variant?: 'overlay' | 'contained';
}

// 클라이언트에서만 true를 반환한다. (서버 스냅샷 false / 클라 스냅샷 true)
// createPortal은 document가 필요해 SSR에선 렌더하지 않으려고 이 값을 가드로 쓴다.
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function PingSpinner() {
  return (
    <div className='relative flex items-center justify-center w-20 h-20'>
      <span className='absolute w-2.5 h-2.5 rounded-full bg-white z-10 animate-[dotPulse_2s_ease-in-out_infinite]' />
      {[0, 0.55, 1.1].map((delay, i) => (
        <span
          key={i}
          className='absolute rounded-full border border-white/70 animate-[rippleOut_2s_ease-out_infinite]'
          style={
            {
              animationDelay: `${delay}s`,
              '--ripple-start': '10px',
              '--ripple-end': '80px',
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function LoadingContent({ label }: { label: string }) {
  return (
    <>
      <PingSpinner />
      <span className='text-[13px] tracking-widest text-white/50 font-light animate-[textFade_2s_ease-in-out_infinite]'>
        {label}
      </span>
    </>
  );
}

/**
 * 핑(ripple) 스피너와 라벨로 구성된 로딩 인디케이터.
 * - 'overlay'(기본): document.body로 portal해 뷰포트 전체를 덮는 fixed 오버레이. 다른 영역엔 inert를 걸어 상호작용을 막는다.
 * - 'contained': portal 없이 absolute로 렌더해 가장 가까운 relative 조상(모바일 프레임) 안만 채운다.
 *
 * @param label - 스피너 아래 표시할 문구
 * @param variant - 표시 방식 ('overlay' | 'contained')
 */
export default function Loading({
  label = '불러오는 중...',
  variant = 'overlay',
}: LoadingProps) {
  const isClient = useIsClient();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (variant !== 'overlay') return;

    const overlay = overlayRef.current;
    if (!overlay) return;

    const siblings = Array.from(document.body.children) as HTMLElement[];
    siblings.forEach((el) => {
      if (!el.contains(overlay)) el.setAttribute('inert', '');
    });
    overlay.focus();

    return () => {
      siblings.forEach((el) => el.removeAttribute('inert'));
    };
  }, [variant]);

  if (variant === 'contained') {
    return (
      <div
        className='absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/80'
        aria-live='polite'
        aria-label={label}
      >
        <LoadingContent label={label} />
      </div>
    );
  }

  if (!isClient) return null;

  return createPortal(
    <div
      ref={overlayRef}
      tabIndex={-1}
      className='fixed inset-0 z-9999 flex flex-col items-center justify-center gap-5 bg-black/80 outline-none'
      aria-live='polite'
      aria-label={label}
    >
      <LoadingContent label={label} />
    </div>,
    document.body,
  );
}
