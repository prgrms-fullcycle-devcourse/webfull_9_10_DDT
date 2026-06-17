import * as React from 'react';
import { cn } from '@/lib/utils';

type HeaderTitleProps = React.ComponentProps<'span'> & {
  align?: 'left' | 'center';
};

/**
 * 모바일 레이아웃 헤더의 제목 텍스트. align으로 좌측/중앙 정렬을 고른다.
 * 나머지 span 속성은 그대로 전달된다.
 *
 * @param align - 'left'(기본, 좌측) | 'center'(가로 전체 중앙 정렬)
 */
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
