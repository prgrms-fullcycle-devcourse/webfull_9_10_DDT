import { Label } from '@/components/ui/label';
import { FormInput } from '@/components/ui/form-input';

interface CountableInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength: number;
}

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
