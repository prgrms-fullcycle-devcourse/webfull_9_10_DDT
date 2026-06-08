'use client';

import { useEffect, useRef, useState } from 'react';
import NoSleep from 'nosleep.js';

interface WakeLockSentinel {
  release: () => Promise<void>;
}

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
