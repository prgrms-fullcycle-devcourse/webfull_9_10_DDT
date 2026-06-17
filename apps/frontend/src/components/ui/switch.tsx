'use client';

import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

function Switch({
  className,
  size = 'default',
  thumbIcon,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default' | 'lg';
  thumbIcon?: React.ReactNode;
}) {
  return (
    <SwitchPrimitive.Root
      data-slot='switch'
      data-size={size}
      className={cn(
        'peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
        'data-[size=sm]:h-3.5 data-[size=sm]:w-6',
        'data-[size=default]:h-[18.4px] data-[size=default]:w-8',
        'data-[size=lg]:h-7.5 data-[size=lg]:w-13', // 추가
        'dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-[state=unchecked]:bg-white/15 border border-white/20 data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot='switch-thumb'
        className={cn(
          'pointer-events-none flex items-center justify-center rounded-full bg-background ring-0 transition-transform',
          'group-data-[size=sm]/switch:size-3',
          'group-data-[size=default]/switch:size-4',
          'group-data-[size=lg]/switch:size-7', // 28px 추가
          'group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)]',
          'group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)]',
          'group-data-[size=lg]/switch:data-checked:translate-x-[calc(100%-2px)]', // 추가
          'group-data-[size=sm]/switch:data-unchecked:translate-x-0',
          'group-data-[size=default]/switch:data-unchecked:translate-x-0',
          'group-data-[size=lg]/switch:data-unchecked:translate-x-0', // 추가
          'dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground',
        )}
      >
        {thumbIcon}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}

export { Switch };
