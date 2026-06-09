import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// 보라색 테마 폼 입력
function FormInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="form-input"
      className={cn(
        'h-[52px] rounded-[16px] border-white/[0.12] bg-[#1A1A2E] px-4 text-base md:text-sm text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/30',
        className,
      )}
      {...props}
    />
  );
}

export { FormInput };
