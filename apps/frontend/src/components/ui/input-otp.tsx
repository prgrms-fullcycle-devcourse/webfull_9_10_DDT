'use client';

import * as React from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import { MinusIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  return (
    <OTPInput
      data-slot='input-otp'
      containerClassName={cn(
        'flex items-center gap-2 has-disabled:opacity-50',
        containerClassName,
      )}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='input-otp-group'
      className={cn('flex items-center', className)}
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  showCaretWhenFilled = false,
  activeIndexOverride = null,
  ...props
}: React.ComponentProps<'div'> & {
  index: number;
  // 채워진 칸을 클릭해 진입했을 때, 기존 글자를 잠시 숨기고 커서만 보여줄지 여부 (기본 false).
  showCaretWhenFilled?: boolean;
  // 편집 중 활성 칸을 강제 지정(>=0). 라이브러리 선택값이 잠깐 끝으로 튀어도
  // 시각적 활성/커서를 이 칸에 고정해 잔상을 막는다. null이면 라이브러리 상태를 따른다.
  activeIndexOverride?: number | null;
}) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  const editing = showCaretWhenFilled;
  // override는 편집 여부와 무관하게 적용한다(빈칸 단일 고정에도 사용 → 더블탭 전체선택 시각 차단).
  const overriding = activeIndexOverride != null && activeIndexOverride >= 0;
  const slotActive = overriding ? activeIndexOverride === index : !!isActive;
  // 활성 칸엔 커서를(편집/고정 시), 평상시엔 라이브러리의 빈칸 커서를 표시한다.
  const showCaret = overriding || editing ? slotActive : !!hasFakeCaret;
  // 편집(채워진 칸 클릭) 중 활성 '채워진' 칸은 글자를 숨기고 커서만 노출한다.
  const hideChar = editing && slotActive && char != null;

  return (
    <div
      data-slot='input-otp-slot'
      data-active={slotActive}
      className={cn(
        'relative flex h-10 w-9 items-center justify-center border-y border-r border-input text-base shadow-xs transition-all outline-none first:rounded-l-lg first:border-l last:rounded-r-lg',
        'data-[active=true]:border-ring data-[active=true]:ring-ring/50 data-[active=true]:z-10 data-[active=true]:ring-3',
        'aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 dark:bg-input/30',
        className,
      )}
      {...props}
    >
      {!hideChar && char}
      {showCaret && (
        <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
          <div className='animate-caret-blink bg-foreground h-4 w-px duration-1000' />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator({ ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot='input-otp-separator' role='separator' {...props}>
      <MinusIcon />
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
