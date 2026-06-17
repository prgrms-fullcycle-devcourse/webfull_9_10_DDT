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

/**
 * 헤더 좌측의 뒤로가기(←) 아이콘 버튼. onClick을 주지 않으면 기본으로 router.back()을 호출한다.
 *
 * @param onClick - 커스텀 클릭 핸들러 (생략 시 router.back())
 * @param iconSize - 화살표 아이콘 픽셀 크기 (기본 24)
 * @param aria-label - 접근성 라벨 (기본 '뒤로가기')
 */
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
