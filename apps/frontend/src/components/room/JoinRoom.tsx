'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { BackButton } from '@/components/layout/BackButton';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { MobileLayout } from '@/components/layout/mobileLayout';
import Loading from '@/components/ui/loading';
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
  getRandomProfileIndex,
} from '@/lib/profileImage';
import { getAuthApi } from '@/api/generated/인증-auth-api/인증-auth-api';
import { getErrorMessage } from '@/lib/error';
import { useAuth } from '@/hooks/useAuth';
import { startTermsAgreementLogin } from '@/lib/authNavigation';
import { queryKeys } from '@/lib/queryKeys';

interface RoomInfo {
  title: string;
  id: string;
  memberCount: number;
  phase: string;
  isHost: boolean;
}

export const JoinRoom = () => {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;
  const { isLoggedIn, me, refetchMe } = useAuth();

  // 회원(로그인 사용자)이면 등록된 닉네임/프로필을 기본값으로 사용 (게스트는 빈 값)
  const isMember = isLoggedIn && me?.role === 'user';
  const defaultNickname = isMember ? (me?.nickname ?? '') : '';

  // 게스트는 초기 프로필을 랜덤으로 1회만 부여한다. (재렌더마다 바뀌지 않게 useState 초기화)
  const [guestRandomProfile] = useState(getRandomProfileIndex);

  const defaultProfile = (() => {
    if (!isMember) return guestRandomProfile;
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

  const {
    data: room,
    isLoading: isRoomLoading,
    isError: isRoomInvalid,
  } = useQuery({
    queryKey: queryKeys.room.detail(code),
    queryFn: async () => {
      const res = await getRoomApi().roomControllerFindById(code);
      return res.data as RoomInfo;
    },
    enabled: !!code,
    retry: false,
  });

  // 내 활성 방 code가 이 방과 같으면 = 참여 중인 멤버 (timer 재접속 허용 판단용)
  const { data: myActiveRoom, isFetched: isMyActiveFetched } = useQuery({
    queryKey: queryKeys.room.active(isLoggedIn, true),
    queryFn: async () => {
      const res = await getRoomApi().roomControllerGetMyActiveRoom();
      return (
        (res as unknown as { data: { code: string; phase: string } | null })
          .data ?? null
      );
    },
    enabled: isLoggedIn,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const isHost = room?.isHost ?? false;

  const isValid =
    nickname.trim().length > 0 &&
    (isHost || (password.length >= 4 && password.length <= 20));

  // 진입 시 방 상태별 처리. 메시지는 백엔드 join 에러 문구에 맞춘다.
  const enteredHandledRef = useRef(false);
  useEffect(() => {
    if (enteredHandledRef.current) {
      return;
    }

    // closed·없는 방은 find가 같은 404를 던져 구분 불가 → 통합 문구로 안내.
    if (isRoomInvalid) {
      enteredHandledRef.current = true;
      toast.error('존재하지 않거나 종료된 방이에요.');
      router.replace('/');
      return;
    }

    if (!room) {
      return;
    }

    // result: 멤버 구분 불가(getMyActiveRoom이 제외) → 모두 차단.
    if (room.phase === 'result') {
      enteredHandledRef.current = true;
      toast.error('종료된 방입니다.');
      router.replace('/');
      return;
    }

    // timer: 참여 중인 멤버는 타이머로, 비멤버는 차단.
    if (room.phase === 'timer') {
      // 멤버 여부 판단을 위해 활성 방 조회 완료까지 대기.
      if (isLoggedIn && !isMyActiveFetched) {
        return;
      }
      enteredHandledRef.current = true;
      if (isLoggedIn && myActiveRoom?.code === code) {
        router.replace(`/room/${code}/timer`);
      } else {
        toast.error('이미 집중 세션이 시작된 방입니다.');
        router.replace('/');
      }
    }
  }, [
    isRoomInvalid,
    room,
    isLoggedIn,
    myActiveRoom,
    isMyActiveFetched,
    code,
    router,
  ]);

  const handleGoogleLogin = () => {
    startTermsAgreementLogin(router.push);
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

    joinMutation.mutate({
      password: isHost ? '' : password,
      nickname,
      profileImage: PROFILE_IMAGE_OPTIONS[selectedProfile].key,
    });
  };

  // 로딩 중 또는 위 effect가 리다이렉트로 처리하는 방이면 폼 대신 로딩 UI를 보여준다.
  if (
    isRoomLoading ||
    isRoomInvalid ||
    room?.phase === 'timer' ||
    room?.phase === 'result'
  ) {
    return <Loading label='방 정보를 불러오는 중...' />;
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
              variant='secondary'
              className='flex-1 h-12 rounded-lg'
              onClick={handleGuestStart}
            >
              게스트로 시작
            </Button>
            <Button
              className='flex-1 h-12 rounded-lg font-bold'
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
            type='submit'
            form='join-room-form'
            disabled={!isValid || joinMutation.isPending}
            size='cta'
            className='disabled:bg-secondary disabled:text-muted-foreground'
          >
            {joinMutation.isPending ? '입장 중...' : '입장하기'}
          </Button>
        }
      >
        <form
          id='join-room-form'
          className='flex flex-col gap-6 pt-2'
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
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
          {!isHost && (
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
        </form>
      </MobileLayout>
    </>
  );
};
