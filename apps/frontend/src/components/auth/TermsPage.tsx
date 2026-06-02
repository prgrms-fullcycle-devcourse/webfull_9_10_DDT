'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import { CenterLayout } from '@/components/layout/centerLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

const PENDING_TERMS_KEY = 'pending_google_terms_agreement';

type TermsAgreement = {
  termsOfService: boolean;
  privacyPolicy: boolean;
  ageVerification: boolean;
};

const EMPTY_TERMS_AGREEMENT: TermsAgreement = {
  termsOfService: false,
  privacyPolicy: false,
  ageVerification: false,
};

const readPendingTerms = (): TermsAgreement | null => {
  try {
    const value = sessionStorage.getItem(PENDING_TERMS_KEY);
    if (!value) return null;

    const parsed = JSON.parse(value) as Partial<TermsAgreement>;
    return {
      termsOfService: !!parsed.termsOfService,
      privacyPolicy: !!parsed.privacyPolicy,
      ageVerification: !!parsed.ageVerification,
    };
  } catch {
    return null;
  }
};

export const TermsPage = () => {
  const [agreement, setAgreement] = useState<TermsAgreement>(
    () => readPendingTerms() ?? EMPTY_TERMS_AGREEMENT,
  );
  const [isLoading, setIsLoading] = useState(false);

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
    window.opener?.postMessage(
      { type: 'TERMS_AGREEMENT_READY', agreement },
      window.location.origin,
    );

    setIsLoading(true);
    window.location.href = `${apiUrl}/auth/google`;
  };

  return (
    <CenterLayout maxWidthClass='md:max-w-md'>
      <div className='w-full flex items-center mb-10'>
        <h1 className='flex-1 text-center font-bold'>?쎄? ?숈쓽</h1>
      </div>

      <div className='text-center mb-10'>
        <div className='flex justify-center mb-10 md:mb-14'>
          <Image
            src='/images/logo.webp'
            alt='媛먯삦 濡쒓퀬'
            width={150}
            height={60}
            className='md:w-[180px] h-auto'
          />
        </div>
        <p className='text-gray-400'>
          ?쒕퉬???댁슜???꾪빐
          <br />
          ?쎄????숈쓽??二쇱꽭??
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
            ?쎄? ?꾩껜?숈쓽
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
              ?쒕퉬???댁슜?쎄? <span className='text-red-500'>(?꾩닔)</span>
            </label>
          </div>
          <ChevronRight className='text-gray-500' />
        </div>

        <div className='flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10'>
          <div className='flex items-center'>
            <Checkbox
              id='privacy'
              checked={agreement.privacyPolicy}
              onCheckedChange={(c) => updateAgreement('privacyPolicy', !!c)}
            />
            <label htmlFor='privacy' className='ml-3 cursor-pointer'>
              媛쒖씤?뺣낫 ?섏쭛 諛??댁슜?숈쓽{' '}
              <span className='text-red-500'>(?꾩닔)</span>
            </label>
          </div>
          <ChevronRight className='text-gray-500' />
        </div>

        <div className='flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10'>
          <div className='flex items-center'>
            <Checkbox
              id='isOver14'
              checked={agreement.ageVerification}
              onCheckedChange={(c) => updateAgreement('ageVerification', !!c)}
            />
            <label htmlFor='isOver14' className='ml-3 cursor-pointer'>
              留?14???댁긽 ?뺤씤 <span className='text-red-500'>(?꾩닔)</span>
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
        {isLoading ? '泥섎━ 以?..' : 'Google濡?怨꾩냽?섍린'}
      </Button>

      <p className='text-center text-xs text-gray-500 mt-6 flex items-center justify-center gap-1'>
        ?덉쟾??蹂댁븞 ?섍꼍?먯꽌 濡쒓렇??吏꾪뻾 以?
      </p>
    </CenterLayout>
  );
};
