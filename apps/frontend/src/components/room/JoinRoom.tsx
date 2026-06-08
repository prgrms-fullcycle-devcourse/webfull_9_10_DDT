'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { BackButton } from '@/components/layout/BackButton';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { Label } from '@/components/ui/label';
import { ProfileImagePicker } from '@/components/common/ProfileImagePicker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getRoomApi } from '@/api/generated/room-api/room-api';
import { toast } from 'sonner';
import {
  PROFILE_IMAGE_OPTIONS,
  getProfileImageOptionKey,
} from '@/lib/profileImage';
import { getAuthApi } from '@/api/generated/인증-auth-api/인증-auth-api';
import { getErrorMessage } from '@/lib/error';
import { useAuth } from '@/hooks/useAuth';

// 런타임에 값이 바뀌지 않는 클라이언트 전용 스냅샷 읽기용 no-op 구독자
const noopSubscribe = () => () => {};

export const JoinRoom = () => {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;
  const { isLoggedIn, isLoading, me, refetchMe } = useAuth();

  // 회원(로그인 사용자)이면 등록된 닉네임/프로필을 기본값으로 사용 (게스트는 빈 값)
  const isMember = isLoggedIn && me?.role === 'user';
  const defaultNickname = isMember ? (me?.nickname ?? '') : '';
  const defaultProfile = (() => {
    if (!isMember) return 0;
    const optionKey = getProfileImageOptionKey(me?.profileImage);
    const idx = PROFILE_IMAGE_OPTIONS.findIndex(
      (item) => item.key === optionKey,
    );
    return idx >= 0 ? idx : 0;
  })();

  // 사용자가 직접 입력하면 그 값이 기본값보다 우선한다 (null = 아직 미입력)
  const [nicknameInput, setNicknameInput] = useState<string | null>(null);
  const [profileInput, setProfileInput] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dialogDismissed, setDialogDismissed] = useState(false);

  const nickname = nicknameInput ?? defaultNickname;
  const selectedProfile = profileInput ?? defaultProfile;

  // sessionStorage는 클라이언트 전용이라, SSR/하이드레이션 불일치 없이 읽기 위해
  // useSyncExternalStore를 사용한다 (서버 스냅샷은 false → 하이드레이션 후 클라이언트 값 반영)
  const isHost = useSyncExternalStore(
    noopSubscribe,
    () => sessionStorage.getItem(`isHost:${code}`) === 'true',
    () => false,
  );
  const isHydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    refetchMe();
  }, [refetchMe]);

  const isValid =
    nickname.trim().length > 0 &&
    isHydrated &&
    (isHost || (password.length >= 4 && password.length <= 20));

  const handleGoogleLogin = () => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || 'http://ddt-test.ddns.net:8080';

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

      await refetchMe(); // loadMe로 이름 바꿨으면 그쪽
      setDialogDismissed(true);
    };

    window.addEventListener('message', handler);
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
      router.push(`/room/${code}/contract`);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, '입장 실패'));
    },
  });

  // 입장 페이지 진입 시 방 존재/유효 여부 검증 (없는 방=404, 종료된 방=403 → isError)
  const { isLoading: isRoomLoading, isError: isRoomInvalid } = useQuery({
    queryKey: ['room', code],
    queryFn: async () => {
      const res = await getRoomApi().roomControllerFindById(code);
      return res.data;
    },
    enabled: !!code,
    retry: false,
  });

  const handleGuestStart = async () => {
    try {
      const res = await getAuthApi().authControllerGuestLogin();
      const data = res.data as { accessToken: string; guestToken: string };

      document.cookie = `access_token=${data.accessToken}; path=/; max-age=86400`;

      await refetchMe();

      setDialogDismissed(true);
    } catch (error) {
      toast.error(getErrorMessage(error, '게스트 시작 실패'));
    }
  };

  const handleSubmit = () => {
    if (!isValid) return;

    const submitPassword = isHost
      ? (sessionStorage.getItem(`hostPassword:${code}`) ?? '')
      : password;

    joinMutation.mutate({
      password: submitPassword,
      nickname,
      profileImage: PROFILE_IMAGE_OPTIONS[selectedProfile].key,
    });
  };

  if (isRoomLoading) {
    return (
      <MobileLayout
        header={
          <>
            <BackButton />
            <HeaderTitle>방 입장하기</HeaderTitle>
          </>
        }
      >
        <div className='pt-16 text-center text-sm text-white/50'>
          방 정보를 불러오는 중...
        </div>
      </MobileLayout>
    );
  }

  if (isRoomInvalid) {
    return (
      <MobileLayout
        header={
          <>
            <BackButton />
            <HeaderTitle>방 입장하기</HeaderTitle>
          </>
        }
      >
        <div className='flex flex-col items-center gap-3 pt-16 text-center'>
          <p className='text-base font-bold text-white'>
            존재하지 않거나 종료된 방이에요.
          </p>
          <p className='text-sm text-white/50'>방 코드를 다시 확인해주세요.</p>
          <Button
            onClick={() => router.push('/')}
            className='mt-3 h-12 rounded-[14px] px-6 font-bold'
          >
            홈으로
          </Button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <>
      <Dialog open={!isLoggedIn && !dialogDismissed}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>어떤 계정으로 입장할까요?</DialogTitle>
            <DialogDescription>
              로그인을 하면 집중 기록이 저장돼요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              className='flex-1 py-6! border border-white/20'
              onClick={handleGuestStart}
            >
              게스트로 시작
            </Button>
            <Button
              className='flex-1 py-6! font-bold'
              onClick={handleGoogleLogin}
            >
              구글 로그인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MobileLayout
        header={
          <>
            <BackButton />
            <HeaderTitle>방 입장하기</HeaderTitle>
          </>
        }
        bottomButton={
          <Button
            disabled={!isValid || joinMutation.isPending}
            onClick={handleSubmit}
            size='cta'
            className='hover:scale-[1.01] active:scale-[0.98] disabled:bg-[#1F2937] disabled:text-[#9CA3AF]'
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
            <FormInput
              type='text'
              placeholder='방에서 사용할 닉네임을 입력해주세요'
              maxLength={10}
              value={nickname}
              onChange={(e) => setNicknameInput(e.target.value)}
            />
            <span className='text-xs text-[#6B7280] text-right'>
              {nickname.length}/10
            </span>
          </div>

          <ProfileImagePicker
            selectedProfile={selectedProfile}
            onSelectProfile={setProfileInput}
          />

          {/* 비밀번호 */}
          {!isHost && isHydrated && (
            <div className='flex flex-col gap-2'>
              <Label className='text-[15px] font-bold text-white/85'>
                방 비밀번호
              </Label>
              <div className='relative flex items-center'>
                <FormInput
                  type={showPassword ? 'text' : 'password'}
                  placeholder='비밀번호를 입력해주세요'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
