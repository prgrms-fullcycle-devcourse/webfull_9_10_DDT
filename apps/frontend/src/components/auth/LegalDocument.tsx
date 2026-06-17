'use client';

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
  return (
    <MobileLayout
      header={
        <>
          <BackButton />
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
