import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * 프로젝트 폼 공통 스타일(높이·배경·포커스 링 등)을 입힌 shadcn Input 래퍼.
 * 닉네임·방 이름·비밀번호 등 폼 입력에 일관된 모양을 주기 위해 쓴다. 나머지 input 속성은 그대로 전달된다.
 */
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
