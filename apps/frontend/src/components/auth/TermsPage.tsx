'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
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

// OAuth를 시작했다가 뒤로가기로 약관 화면에 되돌아온 경우, 이전 동의 체크를 초기화해야 하는지 판단한다.
// (OAuth 시작 플래그가 남아 있으면 = 중간에 돌아온 것 → 보류 동의를 비운다)
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

  const navigation = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;

  if (navigation?.type !== 'reload') return false;

  sessionStorage.removeItem(PENDING_TERMS_KEY);
  return true;
};

/**
 * 약관 동의 화면. 필수 3개 약관(서비스·개인정보·만 14세)에 모두 동의해야 구글 로그인을 시작할 수 있다.
 * 데스크탑은 팝업으로 열리며(isPopup), 동의 상태를 부모 창에 postMessage로 전달하고 OAuth로 이동한다.
 * 약관 전문 페이지 왕복·새로고침·OAuth 중도 복귀 시 동의 상태를 적절히 복원/초기화한다.
 *
 * @param isPopup - 팝업 창으로 열렸는지 여부 (true면 뒤로가기 버튼 숨김)
 */
export const TermsPage = ({ isPopup = false }: { isPopup?: boolean }) => {
  const [agreement, setAgreement] = useState<TermsAgreement>(() => {
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('clear') === 'true'
    ) {
      return EMPTY_TERMS_AGREEMENT;
    }
    return resetAgreementAfterOAuthBack() || resetAgreementAfterReload()
      ? EMPTY_TERMS_AGREEMENT
      : (readPendingTerms() ?? EMPTY_TERMS_AGREEMENT);
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('clear') === 'true') {
        url.searchParams.delete('clear');
        window.history.replaceState(null, '', url.toString());
      }
    }
  }, []);

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

  // role='button'인 동의 토글 영역을 키보드(Enter/Space)로도 조작할 수 있게 한다.
  // (Space는 기본 스크롤 동작을 막기 위해 preventDefault)
  const handleToggleKeyDown =
    (toggle: () => void) => (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    };

  const handleGoogleLogin = () => {
    if (!allChecked) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

    sessionStorage.setItem(PENDING_TERMS_KEY, JSON.stringify(agreement));
    sessionStorage.setItem(TERMS_OAUTH_STARTED_KEY, 'true');
    // OAuth로 이동하기 전에 동의 내용을 부모 창(OAuthMessageHandler)에 먼저 전달해둔다.
    // 로그인 성공 메시지가 오면 부모가 이 동의를 함께 서버로 전송한다.
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
          <div
            role='button'
            tabIndex={0}
            aria-pressed={allChecked}
            onClick={handleAllCheck}
            onKeyDown={handleToggleKeyDown(handleAllCheck)}
            className='flex items-center p-4 pb-4.5 bg-white/5 h-[58px] rounded-[16px] border border-white/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
          >
            <Checkbox
              id='all'
              checked={allChecked}
              className='pointer-events-none'
              tabIndex={-1}
              aria-hidden
            />
            <span className='ml-2 text-lg font-semibold'>약관 전체동의</span>
          </div>
          <div className='h-px w-full bg-white/5' />

          <div className='flex flex-col gap-3'>
            <div
              role='button'
              tabIndex={0}
              aria-pressed={agreement.termsOfService}
              onClick={() =>
                updateAgreement('termsOfService', !agreement.termsOfService)
              }
              onKeyDown={handleToggleKeyDown(() =>
                updateAgreement('termsOfService', !agreement.termsOfService),
              )}
              className='flex items-center justify-between h-[50px] p-4 pb-4.5 pr-2 bg-white/5 rounded-[16px] border border-white/5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
            >
              <div className='flex items-center'>
                <Checkbox
                  id='terms'
                  checked={agreement.termsOfService}
                  className='pointer-events-none'
                  tabIndex={-1}
                  aria-hidden
                />
                <span className='ml-2'>
                  서비스 이용약관{' '}
                  <span className='text-destructive'>(필수)</span>
                </span>
              </div>
              <Link
                href='/terms/service'
                aria-label='서비스 이용약관 전문 보기'
                onClick={(e) => e.stopPropagation()}
                className='rounded-full p-1 text-muted-foreground hover:text-white'
              >
                <ChevronRight />
              </Link>
            </div>

            <div
              role='button'
              tabIndex={0}
              aria-pressed={agreement.privacyPolicy}
              onClick={() =>
                updateAgreement('privacyPolicy', !agreement.privacyPolicy)
              }
              onKeyDown={handleToggleKeyDown(() =>
                updateAgreement('privacyPolicy', !agreement.privacyPolicy),
              )}
              className='flex items-center justify-between h-[50px] p-4 pb-4.5 pr-2 bg-white/5 rounded-[16px] border border-white/5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
            >
              <div className='flex items-center'>
                <Checkbox
                  id='privacy'
                  checked={agreement.privacyPolicy}
                  className='pointer-events-none'
                  tabIndex={-1}
                  aria-hidden
                />
                <span className='ml-2'>
                  개인정보 수집 및 이용동의{' '}
                  <span className='text-destructive'>(필수)</span>
                </span>
              </div>
              <Link
                href='/terms/privacy'
                aria-label='개인정보 처리방침 전문 보기'
                onClick={(e) => e.stopPropagation()}
                className='rounded-full p-1 text-muted-foreground hover:text-white'
              >
                <ChevronRight />
              </Link>
            </div>

            <div
              role='button'
              tabIndex={0}
              aria-pressed={agreement.ageVerification}
              onClick={() =>
                updateAgreement('ageVerification', !agreement.ageVerification)
              }
              onKeyDown={handleToggleKeyDown(() =>
                updateAgreement('ageVerification', !agreement.ageVerification),
              )}
              className='flex items-center justify-between h-[50px] p-4 pb-4.5 bg-white/5 rounded-[16px] border border-white/5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
            >
              <div className='flex items-center'>
                <Checkbox
                  id='isOver14'
                  checked={agreement.ageVerification}
                  className='pointer-events-none'
                  tabIndex={-1}
                  aria-hidden
                />
                <span className='ml-2'>
                  만 14세 이상 확인{' '}
                  <span className='text-destructive'>(필수)</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};
