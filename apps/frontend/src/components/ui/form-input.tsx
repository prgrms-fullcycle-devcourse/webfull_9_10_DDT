import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function FormInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="form-input"
      className={cn(
        'h-13 rounded-lg border-border bg-input px-4 text-base md:text-sm text-foreground placeholder:text-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/30',
        className,
      )}
      {...props}
    />
  );
}

export { FormInput };
