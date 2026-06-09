'use client';

import Link from 'next/link';
import { forwardRef } from 'react';
import { Edit3, LogOut, Settings } from 'lucide-react';

interface MyPageSettingsProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onLogout: () => void;
}

export const MyPageSettings = forwardRef<HTMLDivElement, MyPageSettingsProps>(
  ({ isOpen, onToggle, onClose, onLogout }, ref) => (
    <div className='relative' ref={ref}>
      <button
        type='button'
        aria-label='설정'
        className='flex h-10 w-10 items-center justify-center rounded-full text-icon transition hover:bg-white/5 hover:text-white active:bg-white/15'
        onClick={onToggle}
      >
        <Settings size={24} strokeWidth={1.8} />
      </button>
      {isOpen ? (
        <div className='absolute right-0 top-full z-20 mt-3 min-w-[160px] overflow-hidden rounded-[22px] border border-white/10 bg-[#141A2B] text-white shadow-2xl'>
          <Link
            href='/mypage/edit'
            className='flex items-center gap-2 px-4 py-3 text-sm text-white transition hover:bg-white/5'
            onClick={onClose}
          >
            <Edit3 size={16} />
            <span>프로필 수정</span>
          </Link>
          <button
            type='button'
            onClick={() => {
              onClose();
              onLogout();
            }}
            className='flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-white transition hover:bg-white/5'
          >
            <LogOut size={16} />
            <span>로그아웃</span>
          </button>
        </div>
      ) : null}
    </div>
  ),
);

MyPageSettings.displayName = 'MyPageSettings';
