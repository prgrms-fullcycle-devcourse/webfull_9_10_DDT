'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function SessionRestorer() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.includes('/room/') || pathname.includes('/result/')) return;

    const activeSessionStr = localStorage.getItem('ddt_active_session');
    if (activeSessionStr) {
      const { roomCode } = JSON.parse(activeSessionStr);
      if (window.confirm('진행 중인 집중 세션이 있습니다. 복귀하시겠습니까?')) {
        router.push(`/room/${roomCode}`);
      } else {
        localStorage.removeItem('ddt_active_session');
      }
    }
  }, [router, pathname]);

  return null;
}
