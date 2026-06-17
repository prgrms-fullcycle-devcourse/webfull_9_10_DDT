'use client';

import { useCallback, useRef, useState } from 'react';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

/**
 * Promise 기반 확인(confirm) 다이얼로그 훅. `window.confirm`을 대체해 커스텀 ConfirmDialog와 함께 쓴다.
 *
 * `confirm(opts)`를 호출하면 다이얼로그가 열리고, 사용자가 확인/취소를 누를 때까지 기다렸다가
 * 확인이면 `true`, 취소·바깥클릭이면 `false`로 resolve되는 Promise를 반환한다.
 *
 * @returns `confirm` - 다이얼로그를 띄우고 결과(boolean)를 Promise로 돌려주는 함수
 * @returns `confirmProps` - ConfirmDialog에 그대로 펼쳐(spread) 넣을 제어 props
 */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<(value: boolean) => void>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = () => {
    resolveRef.current?.(true);
    setOpen(false);
  };

  const handleCancel = () => {
    resolveRef.current?.(false);
    setOpen(false);
  };

  return {
    confirm,
    confirmProps: {
      open,
      options,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
      onOpenChange: (newOpen: boolean) => {
        if (!newOpen) {
          handleCancel();
        }
      },
    },
  };
}
