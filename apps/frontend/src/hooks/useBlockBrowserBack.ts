'use client';

import { useEffect } from 'react';

let blockActive = false;
let isForwarding = false;
let guardPath = '';
let forwardTimer: ReturnType<typeof setTimeout> | null = null;

function handlePopState() {
  if (!blockActive) return;

  if (isForwarding) {
    isForwarding = false;
    if (forwardTimer !== null) {
      clearTimeout(forwardTimer);
      forwardTimer = null;
    }
    window.history.pushState(null, '', guardPath);
    return;
  }

  isForwarding = true;
  window.history.go(1);

  forwardTimer = setTimeout(() => {
    if (isForwarding) {
      isForwarding = false;
      forwardTimer = null;
      window.history.pushState(null, '', guardPath);
    }
  }, 200);
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', handlePopState);
}

export function useBlockBrowserBack() {
  useEffect(() => {
    guardPath =
      window.location.pathname +
      window.location.search +
      window.location.hash;

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
