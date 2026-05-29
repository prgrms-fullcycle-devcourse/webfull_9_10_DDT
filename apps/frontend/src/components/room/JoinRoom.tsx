'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { BackButton } from '@/components/layout/BackButton';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/store/useAuthStore';

const PROFILE_IMAGES = [
  '/avatars/bear.png',
  '/avatars/cat.png',
  '/avatars/crocodile.png',
  '/avatars/fox.png',
  '/avatars/hedgehog.png',
  '/avatars/monkey.png',
  '/avatars/penguin.png',
  '/avatars/pig.png',
  '/avatars/rabbit.png',
  '/avatars/shiba.png',
];

interface JoinRoomProps {
  onEnter?: (data: { nickname: string; profileIndex: number; password: string }) => void;
}

export const JoinRoom = ({ onEnter }: JoinRoomProps) => {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;
  const { isLoggedIn, checkLoginStatus, logout } = useAuthStore();

  const [nickname, setNickname] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(0);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogDismissed, setDialogDismissed] = useState(false);

  useEffect(() => {
    checkLoginStatus();
  }, [checkLoginStatus]);

  const handleGoogleLogin = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    window.open(`${apiUrl}/auth/google`, 'Google Login', 'width=500,height=600,left=200,top=200');
  };

  const handleLogout = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const token = document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/)?.[1];
    await fetch(`${apiUrl}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    logout();
  };

  const isValid =
    nickname.trim().length > 0 &&
    password.length >= 4 &&
    password.length <= 12;

  const handleSubmit = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    try {
      await onEnter?.({ nickname, profileIndex: selectedProfile, password });
      router.push(`/room/${code}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Dialog open={!isLoggedIn && !dialogDismissed}>
      <DialogContent className='bg-[#1F2937] border-white/10 rounded-2xl max-w-[320px]'>
        <DialogHeader className='gap-2'>
          <DialogTitle className='text-white text-xl font-bold'>
            어떤 계정으로 입장할까요?
          </DialogTitle>
          <DialogDescription className='text-white/60 text-sm'>
            로그인을 하면 집중 기록이 저장돼요.
          </DialogDescription>
        </DialogHeader>
        <div className='flex gap-3 mt-2'>
          <Button
            variant='outline'
            className='flex-1 h-12 rounded-[14px] border-white/[0.18] bg-[#111827] text-white hover:bg-white/5'
            onClick={() => setDialogDismissed(true)}
          >
            게스트로 시작
          </Button>
          <Button
            className='flex-1 h-12 rounded-[14px] font-bold text-white'
            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)' }}
            onClick={handleGoogleLogin}
          >
            구글 로그인
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <MobileLayout
      header={
        <>
          <BackButton />
          <HeaderTitle>
            방 입장하기
          </HeaderTitle>
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className='absolute right-4 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400 transition-colors'
            >
              로그아웃
            </button>
          ) : (
            <span className='absolute right-4 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400'>
              비로그인
            </span>
          )}
        </>
      }
      bottomButton={
        <Button
          disabled={!isValid || isSubmitting}
          onClick={handleSubmit}
          style={{
            background: isValid ? 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)' : undefined,
            boxShadow: isValid ? '0 0 40px rgba(124,58,237,0.45)' : undefined,
          }}
          className='w-full h-14 rounded-[24px] text-base font-bold text-white hover:scale-[1.01] active:scale-[0.98] disabled:bg-[#1F2937] disabled:text-[#9CA3AF]'
        >
          {isSubmitting ? '입장 중...' : '입장하기'}
        </Button>
      }
    >
      <div className='flex flex-col gap-6 pt-2'>

        {/* 닉네임 */}
        <div className='flex flex-col gap-2'>
          <Label className='text-[15px] font-bold text-white/85'>내 닉네임</Label>
          <Input
            type='text'
            placeholder='방에서 사용할 닉네임을 입력해주세요'
            maxLength={10}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className='h-[52px] rounded-[16px] border-white/[0.12] bg-[#1A1A2E] px-4 text-sm text-white placeholder:text-white/30 focus-visible:border-[#8B5CF6] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/30'
          />
          <span className='text-xs text-[#6B7280] text-right'>{nickname.length}/10</span>
        </div>

        {/* 프로필 이미지 */}
        <div className='flex flex-col gap-3'>
          <Label className='text-[15px] font-bold text-white/85'>프로필 이미지</Label>
          <div className='grid grid-cols-5 gap-3'>
            {PROFILE_IMAGES.map((src, index) => (
              <button
                key={index}
                type='button'
                onClick={() => setSelectedProfile(index)}
                className='relative aspect-square rounded-full bg-[#1A1A2E] border-2 transition-all'
                style={{
                  borderColor: selectedProfile === index ? '#8B5CF6' : 'transparent',
                }}
              >
                <img
                  src={src}
                  alt={`프로필 ${index + 1}`}
                  className='w-full h-full object-cover rounded-full'
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                {selectedProfile === index && (
                  <span className='absolute top-0.5 right-0.5 w-5 h-5 bg-[#8B5CF6] rounded-full flex items-center justify-center'>
                    <svg width='10' height='8' viewBox='0 0 10 8' fill='none'>
                      <path d='M1 4L3.5 6.5L9 1' stroke='white' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 비밀번호 */}
        <div className='flex flex-col gap-2'>
          <Label className='text-[15px] font-bold text-white/85'>방 비밀번호</Label>
          <div className='relative flex items-center'>
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder='비밀번호를 입력해주세요'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='h-[52px] rounded-[16px] border-white/[0.12] bg-[#1A1A2E] px-4 pr-10 text-sm text-white placeholder:text-white/30 focus-visible:border-[#8B5CF6] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/30'
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
          <span className='text-xs text-[#6B7280] pl-0.5'>
            · 비밀번호는 4~12자이어야 합니다.
          </span>
        </div>

      </div>
    </MobileLayout>
    </>
  );
};
