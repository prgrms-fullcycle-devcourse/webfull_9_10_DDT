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

/**
 * 마이페이지 헤더의 설정 버튼과 드롭다운(프로필 수정·로그아웃) 메뉴.
 * 바깥 클릭 감지를 위해 부모(MyPage)가 컨테이너 ref를 받을 수 있도록 forwardRef로 구현한다.
 *
 * @param isOpen - 드롭다운 열림 여부
 * @param onToggle - 설정 버튼 클릭 시 열림 토글
 * @param onClose - 메뉴 항목 선택 등으로 드롭다운을 닫을 때 호출
 * @param onLogout - 로그아웃 메뉴 선택 시 호출(로그아웃 확인 흐름은 부모가 처리)
 */
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
        <div className='absolute right-0 top-full z-20 mt-3 min-w-40 overflow-hidden rounded-[22px] border border-white/10 bg-[#141A2B] text-white shadow-2xl'>
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
