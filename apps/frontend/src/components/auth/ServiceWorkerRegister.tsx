'use client';

import { useEffect } from 'react';

/**
 * 서비스 워커(/sw.js)를 등록하는 컴포넌트. (PWA·웹푸시 동작에 필요)
 * 지원 환경에서만 등록을 시도하고 실패는 경고 로그로만 남긴다. 렌더링은 없다(null).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('서비스 워커 등록 실패:', err);
      });
    }
  }, []);
  
  return null;
}