'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type BackButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  'children' | 'size' | 'variant'
> & {
  iconSize?: number;
};

export function BackButton({
  className,
  onClick,
  iconSize = 24,
  'aria-label': ariaLabel = '뒤로가기',
  ...props
}: BackButtonProps) {
  const router = useRouter();

  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      onClick={onClick ?? (() => router.back())}
      aria-label={ariaLabel}
      className={cn(
        'rounded-full text-icon hover:bg-white/10 hover:text-white',
        className,
      )}
      {...props}
    >
      <ArrowLeft style={{ width: iconSize, height: iconSize }} />
    </Button>
  );
}
