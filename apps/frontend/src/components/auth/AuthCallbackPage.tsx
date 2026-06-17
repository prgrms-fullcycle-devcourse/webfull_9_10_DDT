'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuthApi } from '@/api/generated/인증-auth-api/인증-auth-api';
import Loading from '@/components/ui/loading';
import {
  isCompleteTermsAgreement,
  readPendingTerms,
  PENDING_TERMS_KEY,
  TERMS_LOGIN_RETURN_TO_KEY,
  TERMS_OAUTH_STARTED_KEY,
} from '@/lib/authTerms';
import { queryKeys } from '@/lib/queryKeys';
import { setAccessTokenCookie } from '@/lib/authToken';

const getApiUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

/**
 * 모바일 OAuth 리다이렉트 콜백 화면. (팝업을 못 쓰는 모바일에서 같은 탭으로 돌아올 때)
 * URL 쿼리의 token으로 쿠키를 설정하고, 보류 중이던 약관 동의를 서버에 전송한 뒤
 * 원래 가려던 경로(returnTo)로 이동한다. 처리 동안 로딩 화면을 보여준다.
 */
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
        setMessage('로그인 정보를 확인할 수 없어요.');
        return;
      }

      setAccessTokenCookie(token);

      if (isCompleteTermsAgreement(agreement)) {
        const authApi = getAuthApi(axios.create({ baseURL: getApiUrl() }));
        await authApi.authControllerAgreeTerms(agreement, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          // 409(이미 동의함)는 정상으로 간주한다. 재진입·중복 호출 시에도 실패로 처리하지 않기 위함.
          validateStatus: (status) =>
            (status >= 200 && status < 300) || status === 409,
        });
      }

      // 방 만들기로 가는 흐름이면, 도착 화면에서 뒤로가기로 약관/로그인에 되돌아가지 않도록 플래그를 남긴다.
      if (returnTo === '/room') {
        sessionStorage.setItem('justLoggedIn', 'true');
      }

      sessionStorage.removeItem(PENDING_TERMS_KEY);
      sessionStorage.removeItem(TERMS_LOGIN_RETURN_TO_KEY);
      sessionStorage.removeItem(TERMS_OAUTH_STARTED_KEY);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
      router.replace(returnTo);
    };

    void completeLogin().catch((error) => {
      console.error('Mobile OAuth Callback Error:', error);
      setMessage(
        '로그인은 완료되었으나 약관 동의 처리 중 오류가 발생했어요.',
      );
    });
  }, [queryClient, router, searchParams]);

  return <Loading label={message} />;
};
