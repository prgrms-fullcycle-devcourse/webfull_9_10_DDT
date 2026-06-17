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

/**
 * 헤더의 홈(집) 아이콘 버튼. onClick을 주지 않으면 기본으로 메인('/')으로 이동한다.
 *
 * @param onClick - 커스텀 클릭 핸들러 (생략 시 router.push('/'))
 * @param iconSize - 홈 아이콘 픽셀 크기 (기본 22)
 * @param aria-label - 접근성 라벨 (기본 '홈으로 이동')
 */
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
