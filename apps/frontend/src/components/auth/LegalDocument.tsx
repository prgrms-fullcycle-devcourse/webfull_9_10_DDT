'use client';

import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/layout/BackButton';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { MobileLayout } from '@/components/layout/mobileLayout';
import type { LegalDocumentData } from '@/lib/termsContent';

/**
 * 약관/개인정보 등 법적 문서를 제목·개정일·섹션 구조로 렌더하는 공용 화면.
 * 이용약관·개인정보 처리방침 등 termsContent의 데이터를 그대로 받아 표시한다.
 *
 * @param document - 표시할 법적 문서 데이터 (title·updatedAt·sections)
 */
export function LegalDocument({ document }: { document: LegalDocumentData }) {
  const router = useRouter();

  // 약관 상세는 항상 약관 동의 페이지에서 진입한다.
  // PC는 약관을 팝업 창으로 띄우는데, 팝업에선 router.back()(popstate)이 막혀 동의 페이지로 명시 이동시킨다.
  // 모바일/PWA는 같은 탭이라 back이 정상 동작하므로 원래대로 router.back()을 써서 히스토리·스크롤을 자연 복원한다.
  const handleBack = () => {
    const isPopup =
      typeof window !== 'undefined' &&
      (window.opener != null || window.name === 'Terms Agreement');
    if (isPopup) {
      router.push('/terms?mode=popup');
    } else {
      router.back();
    }
  };

  return (
    <MobileLayout
      header={
        <>
          <BackButton onClick={handleBack} />
          <HeaderTitle>{document.title}</HeaderTitle>
        </>
      }
    >
      <div className='flex flex-col gap-6 pt-2 text-white'>
        <p className='text-xs text-white/40'>
          최종 개정일: {document.updatedAt}
        </p>

        {document.sections.map((section) => (
          <section key={section.title} className='flex flex-col gap-2'>
            <h2 className='text-sm font-bold text-white/90'>{section.title}</h2>
            {section.body.map((paragraph, index) => (
              <p
                key={index}
                className='text-[13px] leading-relaxed text-white/60'
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </MobileLayout>
  );
}
