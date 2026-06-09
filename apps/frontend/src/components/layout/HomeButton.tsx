'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type HomeButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  'children' | 'size' | 'variant'
> & {
  iconSize?: number;
};

export function HomeButton({
  className,
  onClick,
  iconSize = 22,
  'aria-label': ariaLabel = '홈으로 이동',
  ...props
}: HomeButtonProps) {
  const router = useRouter();

  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      onClick={onClick ?? (() => router.push('/'))}
      aria-label={ariaLabel}
      className={cn(
        'rounded-full text-icon hover:bg-white/10 hover:text-white',
        className,
      )}
      {...props}
    >
      <Home style={{ width: iconSize, height: iconSize }} />
    </Button>
  );
}
