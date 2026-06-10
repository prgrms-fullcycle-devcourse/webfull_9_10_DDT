'use client';

import { useEffect } from 'react';

/**
 * 브라우저 뒤로가기를 차단합니다.
 *
 * 핵심 전략: 리스너를 모듈 레벨(컴포넌트 외부)에 한 번만 등록.
 * - React 컴포넌트가 언마운트되어도 리스너가 제거되지 않음
 * - Next.js App Router의 popstate 처리와 독립적으로 동작
 * - blockActive 플래그로 차단 여부를 제어
 */

// ── 모듈 레벨: 컴포넌트 수명주기와 무관하게 한 번만 등록 ──
let blockActive = false;
let isForwarding = false;
let guardPath = '';
let forwardTimer: ReturnType<typeof setTimeout> | null = null;

function handlePopState() {
  if (!blockActive) return;

  if (isForwarding) {
    // history.go(1)로 인한 앞으로가기 popstate → 새 가드 항목 복원
    isForwarding = false;
    if (forwardTimer !== null) {
      clearTimeout(forwardTimer);
      forwardTimer = null;
    }
    window.history.pushState(null, '', guardPath);
    return;
  }

  // 뒤로가기 감지 → 즉시 앞으로 이동해 원래 위치로 복원
  isForwarding = true;
  window.history.go(1);

  // go(1)이 실패할 경우(전방 항목 없음) 안전망
  forwardTimer = setTimeout(() => {
    if (isForwarding) {
      isForwarding = false;
      forwardTimer = null;
      window.history.pushState(null, '', guardPath);
    }
  }, 200);
}

// 브라우저 환경에서만 한 번 등록 (모듈 로드 시)
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', handlePopState);
}

// ── Hook: 컴포넌트 마운트/언마운트 시 차단 플래그 제어 ──
export function useBlockBrowserBack() {
  useEffect(() => {
    guardPath =
      window.location.pathname +
      window.location.search +
      window.location.hash;

    // 가드 항목 추가 (history.go(1)이 이동할 전방 항목 생성)
    window.history.pushState(null, '', guardPath);
    blockActive = true;
    isForwarding = false;

    return () => {
      blockActive = false;
      isForwarding = false;
      guardPath = '';
      if (forwardTimer !== null) {
        clearTimeout(forwardTimer);
        forwardTimer = null;
      }
    };
  }, []);
}
