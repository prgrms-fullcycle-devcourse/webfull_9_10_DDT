'use client';

import { useEffect } from 'react';

/**
 * 브라우저 뒤로가기를 차단합니다.
 *
 * Next.js 16 app-router.js 소스 분석 결과:
 *  - onPopState: event.state === null → 즉시 return (아무것도 안 함)
 *                event.state.__NA !== true → window.location.reload()
 *                event.state.__NA === true → dispatchTraverseAction(url, tree)
 *  - pushState 패치: data.__NA === true 이면 originalPushState 직접 호출 (ACTION_RESTORE 미발동)
 *
 * 전략:
 *  1. 마운트 시 현재 NJ 트리를 저장하고, {__NA:true, tree} 가드 항목 추가
 *     → 뒤로가기 시 가드 항목으로 이동 (같은 URL) → Next.js가 timer 트리를 복원
 *  2. popstate 시 즉시 history.go(1)로 앞으로 이동 → 원래 가드 위치로 복원
 *  3. 앞으로가기 popstate에서 새 가드 항목 추가
 *  4. 리스너를 모듈 레벨에 등록 (컴포넌트 언마운트와 무관하게 항상 활성)
 */

// ── 모듈 레벨 상태 ──────────────────────────────────────────────────────────
let blockActive = false;
let isForwarding = false;
let guardPath = '';
let savedNJTree: unknown = undefined;
let forwardTimer: ReturnType<typeof setTimeout> | null = null;

function buildGuardState() {
  const state: Record<string, unknown> = { __NA: true };
  if (savedNJTree !== undefined) {
    state.__PRIVATE_NEXTJS_INTERNALS_TREE = savedNJTree;
  }
  return state;
}

function pushGuard() {
  if (!guardPath) return;
  // __NA: true → Next.js pushState 패치가 originalPushState를 직접 호출
  // (applyUrlFromHistoryPushReplace/ACTION_RESTORE 미발동 → 불필요한 재렌더 방지)
  window.history.pushState(buildGuardState(), '', guardPath);
}

function handlePopState() {
  if (!blockActive) return;

  if (isForwarding) {
    // history.go(1)로 인한 앞으로가기 → 새 가드 항목 복원 후 종료
    isForwarding = false;
    if (forwardTimer !== null) {
      clearTimeout(forwardTimer);
      forwardTimer = null;
    }
    pushGuard();
    return;
  }

  // 뒤로가기 감지 → 즉시 앞으로 이동으로 원상 복구
  isForwarding = true;
  window.history.go(1);

  // go(1) 실패 안전망: 전방 항목이 없을 때 pushGuard로 직접 복원
  forwardTimer = setTimeout(() => {
    if (isForwarding) {
      isForwarding = false;
      forwardTimer = null;
      pushGuard();
    }
  }, 200);
}

// ── 모듈 로드 시 한 번만 등록 (HMR 재등록 대비 이전 리스너 제거) ──────────
if (typeof window !== 'undefined') {
  const w = window as Window & { __ddt_blockBackListener?: typeof handlePopState };
  if (w.__ddt_blockBackListener) {
    window.removeEventListener('popstate', w.__ddt_blockBackListener);
  }
  w.__ddt_blockBackListener = handlePopState;
  window.addEventListener('popstate', handlePopState);
}

// ── Hook: 페이지별 차단 활성화/비활성화 ──────────────────────────────────────
export function useBlockBrowserBack() {
  useEffect(() => {
    guardPath =
      window.location.pathname +
      window.location.search +
      window.location.hash;

    // 현재 NJ 내부 트리 저장 (Next.js가 hydration 시 history.state에 저장해 놓음)
    savedNJTree = window.history.state?.__PRIVATE_NEXTJS_INTERNALS_TREE;

    // 가드 항목 추가
    pushGuard();

    blockActive = true;
    isForwarding = false;

    return () => {
      blockActive = false;
      isForwarding = false;
      if (forwardTimer !== null) {
        clearTimeout(forwardTimer);
        forwardTimer = null;
      }
      // guardPath, savedNJTree는 다음 페이지의 useEffect에서 덮어씀
    };
  }, []);
}
