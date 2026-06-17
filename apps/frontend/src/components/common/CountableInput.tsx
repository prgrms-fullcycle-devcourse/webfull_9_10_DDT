import { Label } from '@/components/ui/label';
import { FormInput } from '@/components/ui/form-input';

interface CountableInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength: number;
}

/**
 * 라벨 + 텍스트 입력 + 우측 하단 글자 수 카운터(current/max)를 묶은 공용 입력 컴포넌트.
 * 닉네임·방 이름 등 길이 제한이 있는 입력에 쓴다.
 *
 * @param label - 입력 위 라벨
 * @param value - 현재 입력값 (제어 컴포넌트)
 * @param onChange - 값 변경 콜백 (입력 문자열을 그대로 전달)
 * @param placeholder - 플레이스홀더
 * @param maxLength - 최대 글자 수 (입력 제한 + 카운터 분모)
 */
export function CountableInput({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: CountableInputProps) {
  return (
    <div className='flex flex-col gap-2'>
      <Label className='text-[15px] font-bold text-white/85'>{label}</Label>
      <FormInput
        type='text'
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className='text-xs text-[#6B7280] text-right'>
        {value.length}/{maxLength}
      </span>
    </div>
  );
}
