'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CenterLayout } from '@/components/layout/centerLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useAuthStore } from '@/store/useAuthStore';

const TermsPage = () => {
  const router = useRouter();
  const { checkLoginStatus } = useAuthStore();

  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [isOver14, setIsOver14] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const allChecked = terms && privacy && isOver14;

  const handleAllCheck = () => {
    const newState = !allChecked;
    setTerms(newState);
    setPrivacy(newState);
    setIsOver14(newState);
  };

  useEffect(() => {
    const receiveMessage = async (event: MessageEvent) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

      if (event.data?.type === 'OAUTH_SUCCESS') {
        const token = event.data.token;

        document.cookie = `access_token=${token}; path=/; max-age=${60 * 60 * 24}`;
        checkLoginStatus();

        try {
          setIsLoading(true);
          const response = await fetch(`${apiUrl}/auth/terms`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              termsOfService: terms,
              privacyPolicy: privacy,
              ageVerification: isOver14,
            }),
          });

          if (!response.ok) {
            throw new Error('약관 동의 처리에 실패했습니다.');
          }

          router.push('/');
        } catch (error) {
          console.error('Terms Agreement Error:', error);
          alert('로그인은 완료되었으나 약관 동의 처리 중 오류가 발생했습니다.');
        } finally {
          setIsLoading(false);
        }
      }
    };

    window.addEventListener('message', receiveMessage);
    return () => window.removeEventListener('message', receiveMessage);
  }, [terms, privacy, isOver14, router, checkLoginStatus]);

  const handleGoogleLogin = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    window.open(
      `${apiUrl}/auth/google`,
      'Google Login',
      'width=500,height=600,left=200,top=200'
    );
  };

  return (
    <CenterLayout maxWidthClass='md:max-w-md'>
      <div className='w-full flex items-center mb-10'>
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
        disabled={!allChecked || isLoading}
        onClick={handleGoogleLogin}
      >
        <span className='mr-2'>G</span> 
        {isLoading ? '처리 중...' : 'Google로 계속하기'}
      </Button>

      <p className='text-center text-xs text-gray-500 mt-6 flex items-center justify-center gap-1'>
        🔒 안전한 보안 환경에서 로그인 진행 중
      </p>
    </CenterLayout>
  );
};

export default TermsPage;