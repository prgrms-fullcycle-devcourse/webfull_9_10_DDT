'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuthApi } from '@/api/generated/인증-auth-api/인증-auth-api';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { MobileLayout } from '@/components/layout/mobileLayout';
import Loading from '@/components/ui/loading';
import {
  isCompleteTermsAgreement,
  readPendingTerms,
  PENDING_TERMS_KEY,
  TERMS_LOGIN_RETURN_TO_KEY,
  TERMS_OAUTH_STARTED_KEY,
} from '@/lib/authTerms';

const getApiUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export const AuthCallbackPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('로그인 처리 중...');

  useEffect(() => {
    const token = searchParams.get('token');
    const returnTo = sessionStorage.getItem(TERMS_LOGIN_RETURN_TO_KEY) || '/';
    const agreement = readPendingTerms();

    const completeLogin = async () => {
      if (!token) {
        setMessage('로그인 정보를 확인할 수 없습니다.');
        return;
      }

      document.cookie = `access_token=${token}; path=/; max-age=${60 * 60 * 24}`;

      if (isCompleteTermsAgreement(agreement)) {
        const authApi = getAuthApi(axios.create({ baseURL: getApiUrl() }));
        await authApi.authControllerAgreeTerms(agreement, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          validateStatus: (status) =>
            (status >= 200 && status < 300) || status === 409,
        });
      }

      sessionStorage.removeItem(PENDING_TERMS_KEY);
      sessionStorage.removeItem(TERMS_LOGIN_RETURN_TO_KEY);
      sessionStorage.removeItem(TERMS_OAUTH_STARTED_KEY);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      router.replace(returnTo);
    };

    void completeLogin().catch((error) => {
      console.error('Mobile OAuth Callback Error:', error);
      setMessage('로그인은 완료되었으나 약관 동의 처리 중 오류가 발생했습니다.');
    });
  }, [queryClient, router, searchParams]);

  return (
    <MobileLayout header={<HeaderTitle>로그인</HeaderTitle>}>
      <div className='flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center text-white/70'>
        <Loading />
        <p className='text-sm'>{message}</p>
      </div>
    </MobileLayout>
  );
};
