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

function buildGuardState(savedNJTree: unknown) {
  const state: Record<string, unknown> = { __NA: true, ddtGuard: true };
  if (savedNJTree !== undefined) {
    state.__PRIVATE_NEXTJS_INTERNALS_TREE = savedNJTree;
  }
  return state;
}

function pushGuard() {
  const guard = getGuard();
  if (!guard.guardPath) return;
  const currentState = window.history.state as Record<string, unknown> | null;
  if (currentState?.ddtGuard) return;
  window.history.pushState(buildGuardState(guard.savedNJTree), '', guard.guardPath);
}

function handlePopState(event: PopStateEvent) {
  const guard = getGuard();
  if (guard.stack.length === 0) return;

  const state = event.state as Record<string, unknown> | null;
  if (state && state.ddtGuard) {
    event.stopImmediatePropagation();
    return;
  }

  event.stopImmediatePropagation();

  const activeInstance = guard.stack[guard.stack.length - 1];
  if (activeInstance && activeInstance.redirectTo) {
    window.location.replace(activeInstance.redirectTo);
    return;
  }

  window.history.go(1);
}

if (typeof window !== 'undefined') {
  if (window.__ddt_blockBackListener) {
    window.removeEventListener('popstate', window.__ddt_blockBackListener, true);
  }
  window.__ddt_blockBackListener = handlePopState;
  window.addEventListener('popstate', handlePopState, true);
}

export function useBlockBrowserBack(options?: { redirectTo?: string; enabled?: boolean }) {
  useEffect(() => {
    if (options?.enabled === false) return;

    const id = Math.random().toString(36).substring(2, 9);
    const redirectTo = options?.redirectTo ?? null;

    const guard = getGuard();
    guard.guardPath =
      window.location.pathname +
      window.location.search +
      window.location.hash;

    guard.savedNJTree = window.history.state?.__PRIVATE_NEXTJS_INTERNALS_TREE;

    guard.stack.push({ id, redirectTo });

    pushGuard();

    return () => {
      const g = getGuard();
      g.stack = g.stack.filter((item) => item.id !== id);
    };
  }, [options?.redirectTo, options?.enabled]);
}
