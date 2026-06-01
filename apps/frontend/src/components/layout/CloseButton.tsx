'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CloseButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  'children' | 'size' | 'variant'
> & {
  iconSize?: number;
};

export function CloseButton({
  className,
  iconSize = 20,
  'aria-label': ariaLabel = '닫기',
  ...props
}: CloseButtonProps) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      aria-label={ariaLabel}
      className={cn(
        'absolute right-4 rounded-full text-white/75 hover:bg-white/10 hover:text-white',
        className
      )}
      {...props}
    >
      <X size={iconSize} />
    </Button>
  );
}
