'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { BackButton } from '@/components/layout/BackButton';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { MobileLayout } from '@/components/layout/mobileLayout';
import Loading from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { CountableInput } from '@/components/common/CountableInput';
import { PasswordInput } from '@/components/common/PasswordInput';
import { FormInput } from '@/components/ui/form-input';
import { Label } from '@/components/ui/label';
import { ProfileImagePicker } from '@/components/common/ProfileImagePicker';
import { RoomNotFound } from '@/components/room/RoomNotFound';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
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
import { setAccessTokenCookie } from '@/lib/authToken';

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
  const { isLoggedIn, me, refetchMe, isLoading: isAuthLoading } = useAuth();

  // 회원(로그인 사용자)이면 등록된 닉네임/프로필을 기본값으로 사용 (게스트는 빈 값)
  const isMember = isLoggedIn && me?.role === 'user';
  const defaultNickname = isMember ? (me?.nickname ?? '') : '';

  // 게스트는 초기 프로필을 랜덤으로 1회만 부여한다. SSR Hydration 방지를 위해 초기값 0.
  const [guestRandomProfile, setGuestRandomProfile] = useState(0);

  useEffect(() => {
    if (!isMember) {
      setGuestRandomProfile(getRandomProfileIndex());
    }
  }, [isMember]);

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
  const [dialogDismissed, setDialogDismissed] = useState(false);
  const [isForceInvalid, setIsForceInvalid] = useState(false);

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
    (isHost || (password.length >= 4 && password.length <= 12));

  // 타이머 진행 중인 방일 때, 내가 참여 중인 멤버라면 타이머 화면으로 바로 보냄
  useEffect(() => {
    if (
      room?.phase === 'timer' &&
      isLoggedIn &&
      isMyActiveFetched &&
      myActiveRoom?.code === code
    ) {
      router.replace(`/room/${code}/timer`);
    }
  }, [room, isLoggedIn, isMyActiveFetched, myActiveRoom, code, router]);

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
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setIsForceInvalid(true);
        return;
      }
      toast.error(getErrorMessage(err, '입장 실패'));
    },
  });

  const handleGuestStart = async () => {
    try {
      const res = await getAuthApi().authControllerGuestLogin();
      const data = res.data as { accessToken: string; guestToken: string };

      setAccessTokenCookie(data.accessToken);

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

  if (isRoomInvalid || isForceInvalid || room?.phase === 'result') {
    return <RoomNotFound />;
  }

  if (room?.phase === 'timer') {
    if (isLoggedIn && isMyActiveFetched && myActiveRoom?.code === code) {
      return <Loading label='방 복귀 중...' />;
    }
    return (
      <RoomNotFound
        primaryMessage='이미 집중 세션이 시작된 방입니다.'
        description='타이머가 진행 중인 방에는 입장할 수 없어요.'
      />
    );
  }

  // 방 정보 정상 조회 중이거나 인증 로딩 중일 때
  if (isRoomLoading || isAuthLoading || !room) {
    return <Loading label='방 정보를 불러오는 중...' />;
  }

  return (
    <>
      <Dialog open={!isLoggedIn && !dialogDismissed}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>어떤 계정으로 입장할까요?</DialogTitle>
            <DialogDescription>
              로그인을 하면 집중 결과가 저장돼요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='secondary'
              className='flex-1 h-12 rounded-lg'
              onClick={handleGuestStart}
            >
              게스트로 시작하기
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
          <CountableInput
            label='내 닉네임'
            placeholder='방에서 사용할 닉네임을 입력해주세요.'
            maxLength={10}
            value={nickname}
            onChange={setNicknameInput}
          />

          <ProfileImagePicker
            selectedProfile={selectedProfile}
            onSelectProfile={setProfileInput}
          />

          {!isHost && (
            <PasswordInput
              value={password}
              onChange={setPassword}
            />
          )}
        </form>
      </MobileLayout>
    </>
  );
};
