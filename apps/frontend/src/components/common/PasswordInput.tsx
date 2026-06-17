'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { FormInput } from '@/components/ui/form-input';
import { Button } from '@/components/ui/button';

interface PasswordInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}

/**
 * 라벨 + 비밀번호 입력 + 표시/숨김 토글(eye) + 안내 문구를 묶은 공용 입력 컴포넌트.
 * 입력은 12자로 잘라 받으며(maxLength 보강), 방 생성/입장 비밀번호에 공통으로 쓴다.
 *
 * @param label - 입력 위 라벨 (기본 '방 비밀번호')
 * @param value - 현재 비밀번호 값 (제어 컴포넌트)
 * @param onChange - 값 변경 콜백 (12자로 잘린 문자열 전달)
 * @param placeholder - 플레이스홀더
 * @param hint - 하단 안내 문구 (빈 문자열이면 숨김)
 */
export function PasswordInput({
  label = '방 비밀번호',
  value,
  onChange,
  placeholder = '비밀번호를 입력해주세요.',
  hint = '· 비밀번호는 4~12자이어야 해요.',
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className='flex flex-col gap-2'>
      <Label className='text-[15px] font-bold text-white/85'>{label}</Label>
      <div className='relative flex items-center'>
        <FormInput
          type={showPassword ? 'text' : 'password'}
          placeholder={placeholder}
          maxLength={12}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 12))}
          className='pr-10'
        />
        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={() => setShowPassword((v) => !v)}
          aria-label='비밀번호 표시'
          className='absolute right-1 text-[#6B7280] hover:text-white/75 hover:bg-transparent'
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </Button>
      </div>
      {hint && (
        <span className='text-xs text-[#6B7280] pl-0.5'>{hint}</span>
      )}
    </div>
  );
}
