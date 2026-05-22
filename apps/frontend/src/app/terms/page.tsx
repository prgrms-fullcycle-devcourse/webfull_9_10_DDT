'use client';

import { useState } from 'react';
import { CenterLayout } from '@/components/layout/centerLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight } from 'lucide-react';
import Image from 'next/image';

const TermsPage = () => {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [isOver14, setIsOver14] = useState(false);
  const allChecked = terms && privacy && isOver14;

  const handleAllCheck = () => {
    const newState = !allChecked;
    setTerms(newState);
    setPrivacy(newState);
    setIsOver14(newState);
  };

  const handleGoogleLogin = () => {
    window.location.href = '/auth/google';
  };

  return (
    <CenterLayout maxWidthClass='md:max-w-md'>
      <div className='w-full flex items-center mb-10'>
        <button className='text-white' onClick={() => window.close()}>X</button>
        <h1 className='flex-1 text-center font-bold'>약관 동의</h1>
      </div>

      <div className='text-center mb-10'>
        <div className='flex justify-center mb-10 md:mb-14'>
          <Image
            src='/images/logo.webp'
            alt='감옥 로고'
            width={150}
            height={60}
            className='md:w-45 h-auto'
          />
        </div>
        <p className='text-gray-400'>
          서비스 이용을 위해
          <br />
          약관에 동의해주세요.
        </p>
      </div>

      <div className='flex flex-col gap-3 w-full mb-10'>
        <div className='flex items-center p-4 bg-white/5 rounded-xl border border-white/10'>
          <Checkbox
            id='all'
            checked={allChecked}
            onCheckedChange={handleAllCheck}
          />
          <label htmlFor='all' className='ml-3 font-semibold cursor-pointer'>
            약관 전체동의
          </label>
        </div>

        <div className='flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10'>
          <div className='flex items-center'>
            <Checkbox
              id='terms'
              checked={terms}
              onCheckedChange={(c) => setTerms(!!c)}
            />
            <label htmlFor='terms' className='ml-3 cursor-pointer'>
              서비스 이용약관 <span className='text-red-500'>(필수)</span>
            </label>
          </div>
          <ChevronRight className='text-gray-500' />
        </div>

        <div className='flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10'>
          <div className='flex items-center'>
            <Checkbox
              id='privacy'
              checked={privacy}
              onCheckedChange={(c) => setPrivacy(!!c)}
            />
            <label htmlFor='privacy' className='ml-3 cursor-pointer'>
              개인정보 수집 및 이용동의{' '}
              <span className='text-red-500'>(필수)</span>
            </label>
          </div>
          <ChevronRight className='text-gray-500' />
        </div>
        <div className='flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10'>
          <div className='flex items-center'>
            <Checkbox
              id='isOver14'
              checked={isOver14}
              onCheckedChange={(c) => setIsOver14(!!c)}
            />
            <label htmlFor='isOver14' className='ml-3 cursor-pointer'>
              만 14세 이상 확인 <span className='text-red-500'>(필수)</span>
            </label>
          </div>
          <ChevronRight className='text-gray-500' />
        </div>
      </div>

      <Button
        className='w-full h-14 bg-[#5F63F2] hover:bg-[#5F63F2]/90 text-lg font-semibold'
        disabled={!allChecked}
        onClick={handleGoogleLogin}
      >
        <span className='mr-2'>G</span> Google로 계속하기
      </Button>

      <p className='text-center text-xs text-gray-500 mt-6 flex items-center justify-center gap-1'>
        🔒 안전한 보안 환경에서 로그인 진행 중
      </p>
    </CenterLayout>
  );
};

export default TermsPage;