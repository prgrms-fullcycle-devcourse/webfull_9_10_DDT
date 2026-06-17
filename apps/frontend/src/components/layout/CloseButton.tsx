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

/**
 * 헤더 우측에 고정되는 X(닫기) 아이콘 버튼. onClick 등 Button 속성을 그대로 받는다.
 *
 * @param iconSize - X 아이콘 픽셀 크기 (기본 24)
 * @param aria-label - 접근성 라벨 (기본 '닫기')
 */
export function CloseButton({
  className,
  iconSize = 24,
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
        'absolute right-4 rounded-full text-icon hover:bg-white/10 hover:text-white',
        className,
      )}
      {...props}
    >
      <X style={{ width: iconSize, height: iconSize }} />
    </Button>
  );
}
