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
import { useMutation } from '@tanstack/react-query';
import { getRoomApi } from '@/api/generated/room-api/room-api';
import { toast } from 'sonner';

const PROFILE_OPTIONS = [
  { key: 'basic_image_key_01', src: '/avatars/bear.png' },
  { key: 'basic_image_key_02', src: '/avatars/cat.png' },
  { key: 'basic_image_key_03', src: '/avatars/crocodile.png' },
  { key: 'basic_image_key_04', src: '/avatars/fox.png' },
  { key: 'basic_image_key_05', src: '/avatars/hedgehog.png' },
  { key: 'basic_image_key_06', src: '/avatars/monkey.png' },
  { key: 'basic_image_key_07', src: '/avatars/penguin.png' },
  { key: 'basic_image_key_08', src: '/avatars/pig.png' },
  { key: 'basic_image_key_09', src: '/avatars/rabbit.png' },
  { key: 'basic_image_key_10', src: '/avatars/shiba.png' },
];

export const JoinRoom = () => {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;
  const { isLoggedIn, checkLoginStatus, logout } = useAuthStore();

  const [nickname, setNickname] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(0);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dialogDismissed, setDialogDismissed] = useState(false);

  const [isHost, setIsHost] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    checkLoginStatus();
  }, [checkLoginStatus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsHost(sessionStorage.getItem(`isHost:${code}`) === 'true');
    setIsHydrated(true);
  }, [code]);

  const isValid =
    nickname.trim().length > 0 &&
    isHydrated &&
    (isHost || (password.length >= 4 && password.length <= 20));

  const handleGoogleLogin = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

    window.open(
      `${apiUrl}/auth/google`,
      'Google Login',
      'width=500,height=600',
    );

    const handler = async (event: MessageEvent) => {
      if (event.origin !== apiUrl) return;
      if (event.data?.type !== 'OAUTH_SUCCESS') return;

      window.removeEventListener('message', handler);

      if (event.data.token) {
        document.cookie = `access_token=${event.data.token}; path=/; max-age=86400`;
      }

      await useAuthStore.getState().fetchMe(); // loadMe로 이름 바꿨으면 그쪽
      setDialogDismissed(true);
    };

    window.addEventListener('message', handler);
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

  const joinMutation = useMutation({
    mutationFn: async (input: {
      password: string;
      nickname: string;
      profileImage: string;
    }) => {
      const res = await getRoomApi().roomControllerJoinById(code, input);
      return res.data as { id: string; isReturning: boolean };
    },
    onSuccess: () => {
      sessionStorage.removeItem(`isHost:${code}`);
      sessionStorage.removeItem(`hostPassword:${code}`);
      router.push(`/room/${code}/contract`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : '입장 실패');
    },
  });

  const handleSubmit = () => {
    if (!isValid) return;

    const submitPassword = isHost
      ? (sessionStorage.getItem(`hostPassword:${code}`) ?? '')
      : password;

    joinMutation.mutate({
      password: submitPassword,
      nickname,
      profileImage: PROFILE_OPTIONS[selectedProfile].key,
    });
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
              style={{
                background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)',
              }}
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
            <HeaderTitle>방 입장하기</HeaderTitle>
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
            disabled={!isValid || joinMutation.isPending}
            onClick={handleSubmit}
            style={{
              background: isValid
                ? 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)'
                : undefined,
              boxShadow: isValid ? '0 0 40px rgba(124,58,237,0.45)' : undefined,
            }}
            className='w-full h-14 rounded-[24px] text-base font-bold text-white hover:scale-[1.01] active:scale-[0.98] disabled:bg-[#1F2937] disabled:text-[#9CA3AF]'
          >
            {joinMutation.isPending ? '입장 중...' : '입장하기'}
          </Button>
        }
      >
        <div className='flex flex-col gap-6 pt-2'>
          {/* 닉네임 */}
          <div className='flex flex-col gap-2'>
            <Label className='text-[15px] font-bold text-white/85'>
              내 닉네임
            </Label>
            <Input
              type='text'
              placeholder='방에서 사용할 닉네임을 입력해주세요'
              maxLength={10}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className='h-[52px] rounded-[16px] border-white/[0.12] bg-[#1A1A2E] px-4 text-sm text-white placeholder:text-white/30 focus-visible:border-[#8B5CF6] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/30'
            />
            <span className='text-xs text-[#6B7280] text-right'>
              {nickname.length}/10
            </span>
          </div>

          {/* 프로필 이미지 */}
          <div className='flex flex-col gap-3'>
            <Label className='text-[15px] font-bold text-white/85'>
              프로필 이미지
            </Label>
            <div className='grid grid-cols-5 gap-3'>
              {PROFILE_OPTIONS.map((opt, index) => (
                <button
                  key={index}
                  type='button'
                  onClick={() => setSelectedProfile(index)}
                  className='relative aspect-square rounded-full bg-[#1A1A2E] border-2 transition-all'
                  style={{
                    borderColor:
                      selectedProfile === index ? '#8B5CF6' : 'transparent',
                  }}
                >
                  <img
                    src={opt.src}
                    alt={`프로필 ${index + 1}`}
                    className='w-full h-full object-cover rounded-full'
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        'none';
                    }}
                  />
                  {selectedProfile === index && (
                    <span className='absolute top-0.5 right-0.5 w-5 h-5 bg-[#8B5CF6] rounded-full flex items-center justify-center'>
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
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 비밀번호 */}
          {!isHost && (
            <div className='flex flex-col gap-2'>
              <Label className='text-[15px] font-bold text-white/85'>
                방 비밀번호
              </Label>
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
          )}
        </div>
      </MobileLayout>
    </>
  );
};
