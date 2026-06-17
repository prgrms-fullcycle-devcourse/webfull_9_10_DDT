'use client';

import { useEffect } from 'react';

interface GuardInstance {
  id: string;
  redirectTo: string | null;
}

interface GuardState {
  stack: GuardInstance[];
  guardPath: string;
  savedNJTree: unknown;
}

declare global {
  interface Window {
    __ddt_back_guard?: GuardState;
    __ddt_blockBackListener?: (event: PopStateEvent) => void;
  }
}

function getGuard(): GuardState {
  if (typeof window === 'undefined') {
    return {
      stack: [],
      guardPath: '',
      savedNJTree: undefined,
    };
  }
  if (!window.__ddt_back_guard) {
    window.__ddt_back_guard = {
      stack: [],
      guardPath: '',
      savedNJTree: undefined,
    };
  }
  if (!window.__ddt_back_guard.stack) {
    window.__ddt_back_guard.stack = [];
  }
  return window.__ddt_back_guard;
}

// 가드용 history state를 만든다. ddtGuard 플래그로 "이 엔트리는 우리가 끼워넣은 가드"임을 표시하고,
// Next의 내부 라우팅 트리(__PRIVATE_NEXTJS_INTERNALS_TREE)를 함께 실어 pushState 후에도
// Next 라우터가 현재 경로를 잃지 않게 한다. (이게 없으면 가드 엔트리에서 라우팅이 깨질 수 있음)
function buildGuardState(savedNJTree: unknown) {
  const state: Record<string, unknown> = { __NA: true, ddtGuard: true };
  if (savedNJTree !== undefined) {
    state.__PRIVATE_NEXTJS_INTERNALS_TREE = savedNJTree;
  }
  return state;
}

// 현재 경로에 가드 엔트리를 하나 더 쌓는다. 뒤로가기를 누르면 이 가드 엔트리로 먼저 빠지므로
// 실제 이전 페이지로 못 나가게 된다. 이미 가드 엔트리 위라면(ddtGuard) 중복 push하지 않는다.
function pushGuard() {
  const guard = getGuard();
  if (!guard.guardPath) return;
  const currentState = window.history.state as Record<string, unknown> | null;
  if (currentState?.ddtGuard) return;
  window.history.pushState(buildGuardState(guard.savedNJTree), '', guard.guardPath);
}

// 뒤로가기(popstate) 처리. 활성 가드가 없으면 평소대로 둔다.
function handlePopState(event: PopStateEvent) {
  const guard = getGuard();
  if (guard.stack.length === 0) return;

  // 가드 엔트리로 들어온 경우: Next 라우터 등 다른 리스너로 전파만 막고 그대로 머문다.
  const state = event.state as Record<string, unknown> | null;
  if (state && state.ddtGuard) {
    event.stopImmediatePropagation();
    return;
  }

  // 가드 밖으로 나가려는 경우: 다른 리스너 전파를 막고,
  event.stopImmediatePropagation();

  // 가장 최근 가드에 redirectTo가 있으면 그쪽으로 보내고, 없으면 history.go(1)로 다시 앞으로 밀어 제자리 유지.
  const activeInstance = guard.stack[guard.stack.length - 1];
  if (activeInstance && activeInstance.redirectTo) {
    window.location.replace(activeInstance.redirectTo);
    return;
  }

  window.history.go(1);
}

// popstate 리스너는 모듈 로드 시 전역에 단 하나만 등록한다(여러 컴포넌트가 훅을 써도 중복 등록 방지).
// capture 단계(true)로 등록해 Next 라우터의 popstate 핸들러보다 먼저 가로챌 수 있게 한다.
if (typeof window !== 'undefined') {
  if (window.__ddt_blockBackListener) {
    window.removeEventListener('popstate', window.__ddt_blockBackListener, true);
  }
  window.__ddt_blockBackListener = handlePopState;
  window.addEventListener('popstate', handlePopState, true);
}

/**
 * 브라우저 뒤로가기를 차단하는 훅. history에 가드 엔트리를 쌓아 popstate를 가로채고,
 * redirectTo가 있으면 그 경로로 보내고 없으면 현재 화면에 머무르게 한다.
 * (예: 로그인 직후 진입한 화면에서 뒤로가기로 약관/로그인 화면에 되돌아가는 것을 막을 때)
 * 여러 컴포넌트가 동시에 써도 되도록 전역 스택으로 관리하며, 언마운트 시 자신의 가드만 제거한다.
 *
 * @param options.redirectTo - 뒤로가기 시 이동시킬 경로 (없으면 제자리 유지)
 * @param options.enabled - false면 차단을 비활성화 (기본 활성)
 */
export function useBlockBrowserBack(options?: { redirectTo?: string; enabled?: boolean }) {
  useEffect(() => {
    if (options?.enabled === false) return;

    // 인스턴스마다 고유 id를 부여해, 언마운트 시 전역 스택에서 자신의 가드만 골라 제거한다.
    const id = Math.random().toString(36).substring(2, 9);
    const redirectTo = options?.redirectTo ?? null;

    const guard = getGuard();
    // 가드 엔트리를 쌓을 때 URL이 바뀌지 않도록 현재 경로(path+query+hash)를 그대로 보존한다.
    guard.guardPath =
      window.location.pathname +
      window.location.search +
      window.location.hash;

    // 현재 Next 라우팅 트리를 보관해, 가드 엔트리에도 실어줌으로써 라우터 상태가 끊기지 않게 한다.
    guard.savedNJTree = window.history.state?.__PRIVATE_NEXTJS_INTERNALS_TREE;

    guard.stack.push({ id, redirectTo });

    pushGuard();

    return () => {
      const g = getGuard();
      g.stack = g.stack.filter((item) => item.id !== id);
    };
  }, [options?.redirectTo, options?.enabled]);
}
