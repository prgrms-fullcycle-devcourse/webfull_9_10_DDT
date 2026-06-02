'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

type TermsAgreement = {
  termsOfService: boolean;
  privacyPolicy: boolean;
  ageVerification: boolean;
};

const getApiUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const getOrigin = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
};

const isTermsAgreement = (value: unknown): value is TermsAgreement => {
  if (!value || typeof value !== 'object') return false;

  const agreement = value as Partial<TermsAgreement>;
  return (
    agreement.termsOfService === true &&
    agreement.privacyPolicy === true &&
    agreement.ageVerification === true
  );
};

export function OAuthMessageHandler() {
  const router = useRouter();
  const fetchMe = useAuthStore((state) => state.fetchMe);
  const pendingTermsRef = useRef<TermsAgreement | null>(null);

  useEffect(() => {
    const apiUrl = getApiUrl();
    const allowedOrigins = new Set([window.location.origin, getOrigin(apiUrl)]);

    const agreeTerms = async (token: string, agreement: TermsAgreement) => {
      const response = await fetch(`${apiUrl}/auth/terms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(agreement),
      });

      if (!response.ok && response.status !== 409) {
        throw new Error('Terms agreement failed');
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (!allowedOrigins.has(event.origin)) return;

      if (event.data?.type === 'TERMS_AGREEMENT_READY') {
        if (isTermsAgreement(event.data.agreement)) {
          pendingTermsRef.current = event.data.agreement;
        }
        return;
      }

      if (event.data?.type !== 'OAUTH_SUCCESS') return;

      const token = event.data.token;
      if (typeof token !== 'string' || !token) return;

      document.cookie = `access_token=${token}; path=/; max-age=${60 * 60 * 24}`;

      const agreement = pendingTermsRef.current;
      void (async () => {
        try {
          if (agreement) {
            await agreeTerms(token, agreement);
            pendingTermsRef.current = null;
          }
          await fetchMe();
          router.refresh();
        } catch (error) {
          console.error('Terms Agreement Error:', error);
          alert('로그인은 완료되었으나 약관 동의 처리 중 오류가 발생했습니다.');
        }
      })();
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchMe, router]);

  return null;
}
