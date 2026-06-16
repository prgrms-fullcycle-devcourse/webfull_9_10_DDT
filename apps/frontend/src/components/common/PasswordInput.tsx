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
