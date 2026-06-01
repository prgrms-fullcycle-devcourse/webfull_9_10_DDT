'use client';

import { Button } from '@/components/ui/button';

interface MyPageDeleteButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isDeleting?: boolean;
}

export function MyPageDeleteButton({ onClick, disabled, isDeleting }: MyPageDeleteButtonProps) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      className='text-sm font-medium text-[#A3A1B3] transition hover:text-white disabled:cursor-not-allowed disabled:text-[#6B6B7B]'
      onClick={onClick}
      disabled={disabled}
    >
      {isDeleting ? '탈퇴 중...' : '회원 탈퇴'}
    </Button>
  );
}
