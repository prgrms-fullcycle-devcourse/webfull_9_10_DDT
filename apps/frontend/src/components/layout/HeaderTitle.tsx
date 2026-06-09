import * as React from 'react';
import { cn } from '@/lib/utils';

type HeaderTitleProps = React.ComponentProps<'span'> & {
  align?: 'left' | 'center';
};

export function HeaderTitle({ className, align = 'left', children, ...props }: HeaderTitleProps) {
  return (
    <span
      className={cn(
        'text-[18px] font-normal tracking-tight',
        align === 'center' ? 'w-full text-center' : 'ml-1',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
