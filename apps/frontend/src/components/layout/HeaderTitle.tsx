import * as React from 'react';
import { cn } from '@/lib/utils';

type HeaderTitleProps = React.ComponentProps<'span'>;

export function HeaderTitle({ className, children, ...props }: HeaderTitleProps) {
  return (
    <span
      className={cn('ml-[4px] text-[18px] font-normal tracking-tight', className)}
      {...props}
    >
      {children}
    </span>
  );
}
