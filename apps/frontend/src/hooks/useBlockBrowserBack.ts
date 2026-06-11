'use client';

import { useEffect } from 'react';

let blockActive = false;
let guardPath = '';
let savedNJTree: unknown = undefined;
let redirectTarget: string | null = null;

function buildGuardState() {
  const state: Record<string, unknown> = { __NA: true, ddtGuard: true };
  if (savedNJTree !== undefined) {
    state.__PRIVATE_NEXTJS_INTERNALS_TREE = savedNJTree;
  }
  return state;
}

function pushGuard() {
  if (!guardPath) return;
  const currentState = window.history.state as Record<string, unknown> | null;
  if (currentState?.ddtGuard) return;
  window.history.pushState(buildGuardState(), '', guardPath);
}

function handlePopState(event: PopStateEvent) {
  if (!blockActive) return;

  const state = event.state as Record<string, unknown> | null;
  if (state && state.ddtGuard) {
    event.stopImmediatePropagation();
    return;
  }

  event.stopImmediatePropagation();

  if (redirectTarget) {
    window.location.replace(redirectTarget);
    return;
  }

  window.history.go(1);
}

if (typeof window !== 'undefined') {
  const w = window as Window & { __ddt_blockBackListener?: typeof handlePopState };
  if (w.__ddt_blockBackListener) {
    window.removeEventListener('popstate', w.__ddt_blockBackListener, true);
  }
  w.__ddt_blockBackListener = handlePopState;
  window.addEventListener('popstate', handlePopState, true);
}

export function useBlockBrowserBack(options?: { redirectTo?: string }) {
  useEffect(() => {
    guardPath =
      window.location.pathname +
      window.location.search +
      window.location.hash;

    savedNJTree = window.history.state?.__PRIVATE_NEXTJS_INTERNALS_TREE;
    redirectTarget = options?.redirectTo ?? null;

    pushGuard();

    blockActive = true;

    return () => {
      blockActive = false;
      redirectTarget = null;
    };
  }, [options?.redirectTo]);
}
