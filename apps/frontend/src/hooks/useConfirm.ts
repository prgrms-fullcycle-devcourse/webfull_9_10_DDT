'use client';

import { useCallback, useRef, useState } from 'react';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

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
