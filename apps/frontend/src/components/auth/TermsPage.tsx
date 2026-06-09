'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BackButton } from '@/components/layout/BackButton';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  EMPTY_TERMS_AGREEMENT,
  PENDING_TERMS_KEY,
  TERMS_OAUTH_STARTED_KEY,
  readPendingTerms,
  type TermsAgreement,
} from '@/lib/authTerms';

const resetAgreementAfterOAuthBack = () => {
  if (typeof window === 'undefined') return false;

  if (sessionStorage.getItem(TERMS_OAUTH_STARTED_KEY) !== 'true') {
    return false;
  }

  sessionStorage.removeItem(TERMS_OAUTH_STARTED_KEY);
  sessionStorage.removeItem(PENDING_TERMS_KEY);
  return true;
};

const resetAgreementAfterReload = () => {
  if (typeof window === 'undefined') return false;

  const navigation = performance.getEntriesByType(
    'navigation',
  )[0] as PerformanceNavigationTiming | undefined;

  if (navigation?.type !== 'reload') return false;

  sessionStorage.removeItem(PENDING_TERMS_KEY);
  return true;
};

export const TermsPage = ({ isPopup = false }: { isPopup?: boolean }) => {
  const [agreement, setAgreement] = useState<TermsAgreement>(
    () =>
      resetAgreementAfterOAuthBack() || resetAgreementAfterReload()
        ? EMPTY_TERMS_AGREEMENT
        : (readPendingTerms() ?? EMPTY_TERMS_AGREEMENT),
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handlePageShow = () => {
      if (!resetAgreementAfterOAuthBack()) return;

      setAgreement(EMPTY_TERMS_AGREEMENT);
      setIsLoading(false);
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  // 약관 전문 페이지로 이동했다 돌아와도 체크 상태가 유지되도록 저장한다.
  useEffect(() => {
    sessionStorage.setItem(PENDING_TERMS_KEY, JSON.stringify(agreement));
  }, [agreement]);

  const allChecked =
    agreement.termsOfService &&
    agreement.privacyPolicy &&
    agreement.ageVerification;

  const handleAllCheck = () => {
    const newState = !allChecked;
    setAgreement({
      termsOfService: newState,
      privacyPolicy: newState,
      ageVerification: newState,
    });
  };

  const updateAgreement = (key: keyof TermsAgreement, value: boolean) => {
    setAgreement((current) => ({ ...current, [key]: value }));
  };

  const handleGoogleLogin = () => {
    if (!allChecked) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

    sessionStorage.setItem(PENDING_TERMS_KEY, JSON.stringify(agreement));
    sessionStorage.setItem(TERMS_OAUTH_STARTED_KEY, 'true');
    window.opener?.postMessage(
      { type: 'TERMS_AGREEMENT_READY', agreement },
      window.location.origin,
    );

    setIsLoading(true);
    window.location.href = `${apiUrl}/auth/google`;
  };

  return (
    <MobileLayout
      header={
        <>
          {!isPopup ? <BackButton /> : null}
          <HeaderTitle>약관 동의</HeaderTitle>
        </>
      }
      bottomButton={
        <Button
          size='cta'
          disabled={!allChecked || isLoading}
          onClick={handleGoogleLogin}
        >
          {isLoading ? '처리 중...' : 'Google로 계속하기'}
        </Button>
      }
    >
      <div className='flex flex-col gap-6 pt-2'>
        <p className='text-center text-[20px] leading-relaxed text-white/70'>
          서비스 이용을 위해
          <br />
          약관에 동의해 주세요.
        </p>

        <div className='flex flex-col gap-3 w-full'>
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
                checked={agreement.termsOfService}
                onCheckedChange={(c) => updateAgreement('termsOfService', !!c)}
              />
              <label htmlFor='terms' className='ml-3 cursor-pointer'>
                서비스 이용약관 <span className='text-destructive'>(필수)</span>
              </label>
            </div>
            <Link
              href='/terms/service'
              aria-label='서비스 이용약관 전문 보기'
              className='rounded-full p-1 text-muted-foreground hover:text-white'
            >
              <ChevronRight />
            </Link>
          </div>

          <div className='flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10'>
            <div className='flex items-center'>
              <Checkbox
                id='privacy'
                checked={agreement.privacyPolicy}
                onCheckedChange={(c) => updateAgreement('privacyPolicy', !!c)}
              />
              <label htmlFor='privacy' className='ml-3 cursor-pointer'>
                개인정보 수집 및 이용동의{' '}
                <span className='text-destructive'>(필수)</span>
              </label>
            </div>
            <Link
              href='/terms/privacy'
              aria-label='개인정보 처리방침 전문 보기'
              className='rounded-full p-1 text-muted-foreground hover:text-white'
            >
              <ChevronRight />
            </Link>
          </div>

          <div className='flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10'>
            <div className='flex items-center'>
              <Checkbox
                id='isOver14'
                checked={agreement.ageVerification}
                onCheckedChange={(c) => updateAgreement('ageVerification', !!c)}
              />
              <label htmlFor='isOver14' className='ml-3 cursor-pointer'>
                만 14세 이상 확인 <span className='text-destructive'>(필수)</span>
              </label>
            </div>
          </div>
        </div>

        <p className='text-center text-xs text-muted-foreground'>
          안전한 보안 환경에서 로그인 진행 중
        </p>
      </div>
    </MobileLayout>
  );
};
