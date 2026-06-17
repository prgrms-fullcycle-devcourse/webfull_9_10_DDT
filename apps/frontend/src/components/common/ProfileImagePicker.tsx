'use client';

import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { PROFILE_IMAGE_OPTIONS } from '@/lib/profileImage';

interface ProfileImagePickerProps {
  selectedProfile: number;
  onSelectProfile: (index: number) => void;
  label?: string;
  description?: string;
}

const BLUR_PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * 기본 프로필 이미지(PROFILE_IMAGE_OPTIONS)를 5열 그리드로 보여주고 하나를 고르는 선택기.
 * 선택된 항목은 보라색 테두리 + 체크 표시로 강조한다. 값은 옵션 배열의 인덱스로 관리한다.
 *
 * @param selectedProfile - 현재 선택된 옵션 인덱스
 * @param onSelectProfile - 선택 시 해당 인덱스를 전달하는 콜백
 * @param label - 상단 라벨 (기본 '프로필 이미지')
 * @param description - 라벨 우측 보조 설명 (선택)
 */
export function ProfileImagePicker({
  selectedProfile,
  onSelectProfile,
  label = '프로필 이미지',
  description,
}: ProfileImagePickerProps) {
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between gap-3'>
        <Label className='text-[15px] font-bold text-white/85'>{label}</Label>
        {description ? (
          <span className='text-[12px] text-[#A3A1B3]'>{description}</span>
        ) : null}
      </div>
      <div className='grid grid-cols-5 gap-3'>
        {PROFILE_IMAGE_OPTIONS.map((opt, index) => (
          <button
            key={opt.key}
            type='button'
            onClick={() => onSelectProfile(index)}
            className='relative aspect-square rounded-full bg-[#1A1A2E] border-2 transition-all'
            style={{
              borderColor: selectedProfile === index ? '#8B5CF6' : 'transparent',
            }}
          >
            <Image
              src={opt.src}
              alt={opt.label}
              fill
              placeholder='blur'
              blurDataURL={BLUR_PLACEHOLDER}
              sizes='(max-width: 390px) 60px, 80px'
              className='object-cover rounded-full z-0'
            />
            {selectedProfile === index ? (
              <span className='absolute top-0.5 z-10 right-0.5 w-5 h-5 bg-[#8B5CF6] rounded-full flex items-center justify-center'>
                <svg width='10' height='8' viewBox='0 0 10 8' fill='none'>
                  <path
                    d='M1 4L3.5 6.5L9 1'
                    stroke='white'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
