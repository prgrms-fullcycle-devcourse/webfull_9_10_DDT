'use client';

import { useEffect, useRef, useState } from 'react';
import NoSleep from 'nosleep.js';

interface WakeLockSentinel {
  release: () => Promise<void>;
}

/**
 * 집중 세션 동안 화면이 꺼지지 않게 유지하는 훅.
 * 표준 Screen Wake Lock API를 우선 사용하고, 미지원/실패 시 nosleep.js로 폴백한다.
 * Wake Lock은 사용자 제스처가 필요하므로 첫 클릭/터치와 visibilitychange(다시 보일 때)에 활성화를 시도한다.
 *
 * @returns `isSupported` - 화면 꺼짐 방지를 활성화할 수 있는 환경인지 여부
 */
export function useWakeLock() {
  const noSleepRef = useRef<NoSleep | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const noSleepEnableRef = useRef(false);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    noSleepRef.current = new NoSleep();

    const enableWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (
            navigator as unknown as {
              wakeLock: {
                request: (type: string) => Promise<WakeLockSentinel>;
              };
            }
          ).wakeLock.request('screen');
          console.log('WakeLock API 활성화 완료');
        } else {
          throw new Error('WakeLock API 미지원 환경');
        }
      } catch (err) {
        console.log(err);
        try {
          if (noSleepEnableRef.current) {
            return;
          }
          noSleepRef.current?.enable();
          noSleepEnableRef.current = true;
          console.log('NoSleep.js 활성화 완료 (Fallback)');
          setIsSupported(true);
        } catch (fallbackErr) {
          console.warn(
            '화면 꺼짐 방지 활성화 불가 (사용자 제스처 필요)',
            fallbackErr,
          );
          setIsSupported(false);
        }
      }
    };

    const handleInteraction = () => {
      enableWakeLock();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if ('wakeLock' in navigator) {
          void enableWakeLock();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
      noSleepRef.current?.disable();
      noSleepEnableRef.current = false;
    };
  }, []);

  return { isSupported };
}
