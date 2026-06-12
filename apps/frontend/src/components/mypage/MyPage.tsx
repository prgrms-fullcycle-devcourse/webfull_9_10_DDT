'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Clock3 } from 'lucide-react';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { HomeButton } from '@/components/layout/HomeButton';
import { MobileLayout } from '@/components/layout/mobileLayout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MyPageSettings } from '@/components/mypage/MyPageSettings';
import {
  MyPageHistoryList,
  HistoryItem,
} from '@/components/mypage/MyPageHistoryList';
import { formatDuration } from '@/lib/format';
import {
  DEFAULT_PROFILE_IMAGE_KEY,
  getProfileImageSrc,
} from '@/lib/profileImage';
import { getUsers } from '@/api/generated/users-사용자/users-사용자';
import { getAuthApi } from '@/api/generated/인증-auth-api/인증-auth-api';
import { useAuth } from '@/hooks/useAuth';
import { useActiveRoom, getActiveRoomPath } from '@/hooks/useActiveRoom';

type UserProfile = {
  userId: string;
  nickname: string;
  email: string;
  profileImage?: string;
};

type UserStats = {
  totalRoomCount: number;
  totalFocusMs: number;
  totalEscapeMs: number;
};

const emptyStats: UserStats = {
  totalRoomCount: 0,
  totalFocusMs: 0,
  totalEscapeMs: 0,
};

const BLUR_PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export const MyPage = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats>(emptyStats);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const settingsRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const { logout } = useAuth();
  const activeRoom = useActiveRoom();

  // 진행 중인 방이 있으면 phase에 맞는 '방 복귀하기'로, 없으면 '새로운 방 만들기'(/room)로.
  const roomButtonHref = activeRoom ? getActiveRoomPath(activeRoom) : '/room';

  useEffect(() => {
    // baseURL·토큰·응답 언래핑은 전역 axiosClient 인터셉터가 처리한다.
    const usersApi = getUsers();

    const loadProfile = async () => {
      setIsLoadingProfile(true);

      try {
        const response = await usersApi.usersControllerGetMe();
        setProfile((response.data as UserProfile) ?? null);
      } catch {
        setErrorMessage('내 정보를 불러오지 못했습니다.');
      } finally {
        setIsLoadingProfile(false);
      }
    };

    const loadStatsAndHistory = async () => {
      setIsLoadingHistory(true);

      try {
        const [statsResponse, historyResponse] = await Promise.all([
          usersApi.usersControllerGetMyStats(),
          usersApi.usersControllerGetMyHistory({ limit: 3 }),
        ]);

        setStats((statsResponse.data as UserStats) ?? emptyStats);

        const historyData = historyResponse.data as {
          sessions?: HistoryItem[];
        };
        setHistory(historyData?.sessions?.slice(0, 3) ?? []);
      } catch {
        setErrorMessage('마이페이지 정보를 불러오지 못했습니다.');
      } finally {
        setIsLoadingHistory(false);
      }
    };

    void loadProfile();
    void loadStatsAndHistory();
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen]);

  const openLogoutConfirm = () => {
    setIsLogoutConfirmOpen(true);
  };

  const executeLogout = async () => {
    // 토큰 첨부는 인터셉터가 처리. 토큰이 없으면 요청은 실패해도 무시하고 로컬 로그아웃 진행.
    await getAuthApi()
      .authControllerLogout()
      .catch(() => {});

    logout();
    router.push('/');
  };

  const summaryCards = useMemo(
    () => [
      {
        label: '참여한 방',
        value: `${stats.totalRoomCount}회`,
        className: 'col-span-1 row-span-2 bg-[#1D1C2C]',
        icon: true,
      },
      {
        label: '총 완료 시간',
        value: formatDuration(stats.totalFocusMs),
        className: 'bg-[#0B241A]',
      },
      {
        label: '총 이탈 시간',
        value: formatDuration(stats.totalEscapeMs),
        className: 'bg-[#2A0E16]',
      },
    ],
    [stats],
  );

  const profileImageSrc = profile
    ? (getProfileImageSrc(profile.profileImage) ??
      getProfileImageSrc(DEFAULT_PROFILE_IMAGE_KEY))
    : undefined;

  return (
    <MobileLayout
      header={
        <>
          <HomeButton />
          <HeaderTitle>마이 페이지</HeaderTitle>
          <div className='flex-1' />
          <MyPageSettings
            ref={settingsRef}
            isOpen={isSettingsOpen}
            onToggle={() => setIsSettingsOpen((prev) => !prev)}
            onClose={() => setIsSettingsOpen(false)}
            onLogout={() => {
              setIsSettingsOpen(false);
              openLogoutConfirm();
            }}
          />
        </>
      }
    >
      <section className='mb-5 flex items-center gap-4 pt-2'>
        <div className='relative size-[62px] shrink-0 overflow-hidden rounded-full border-2 border-[#914CFF] bg-[#201E34]'>
          {profileImageSrc ? (
            <Image
              src={profileImageSrc}
              alt={`${profile?.nickname ?? '사용자'} 프로필`}
              width={62}
              height={62}
              placeholder='blur' 
              blurDataURL={BLUR_PLACEHOLDER} 
              className='h-full w-full object-cover'
            />
          ) : null}
        </div>

        <div className='min-w-0'>
          {profile ? (
            <>
              <p className='truncate text-[18px] font-bold leading-6 text-white'>
                {profile.nickname}
              </p>
              <p className='truncate text-[14px] leading-5 text-[#81808D]'>
                {profile.email}
              </p>
            </>
          ) : isLoadingProfile ? (
            <>
              <div className='mb-2 h-5 w-20 rounded bg-white/10' />
              <div className='h-4 w-36 rounded bg-white/10' />
            </>
          ) : (
            <p className='text-[14px] text-[#FF606B]'>{errorMessage}</p>
          )}
        </div>
      </section>

      <Link
        href={roomButtonHref}
        className='mb-4 flex h-[51px] w-full items-center justify-center rounded-[14px] border border-[#914CFF] bg-[#242136] text-[15px] font-bold text-white/90 transition hover:bg-[#2A2640] active:scale-[0.98]'
      >
        {activeRoom ? '방 복귀하기' : '새로운 방 만들기'}
      </Link>

      <section className='mb-12 grid h-[140px] grid-cols-2 grid-rows-2 gap-2'>
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={`relative flex flex-col overflow-hidden rounded-[12px] px-3 py-4 ${
              card.icon ? '' : 'justify-center'
            } ${card.className}`}
          >
            <p
              className={`text-center text-[11px] font-medium text-[#767481] ${
                card.icon ? 'mt-2' : ''
              }`}
            >
              {card.label}
            </p>
            <p className='mt-1 text-center text-[20px] font-extrabold leading-7 text-white/90'>
              {card.value}
            </p>
            {card.icon ? (
              <Clock3
                className='absolute -bottom-[28px] left-1/2 size-[78px] -translate-x-1/2 text-white/10'
                strokeWidth={1.6}
              />
            ) : null}
          </div>
        ))}
      </section>

      <section>
        <div className='mb-3 flex items-center justify-between'>
          <h2 className='text-[14px] font-medium text-[#898793]'>
            최근 참여 기록
          </h2>
          <Link
            href='/mypage/history'
            className='flex items-center gap-1 text-[13px] font-medium text-[#898793] transition hover:text-white'
          >
            전체 보기
            <ChevronRight size={14} strokeWidth={1.8} />
          </Link>
        </div>

        <MyPageHistoryList
          history={history}
          isLoading={isLoadingHistory}
          errorMessage={errorMessage}
          emptyMessage='최근 참여 기록이 없습니다.'
          errorOnlyWhenEmpty
          chevronDirection='right'
          from='mypage'
        />
      </section>

      <Dialog open={isLogoutConfirmOpen} onOpenChange={setIsLogoutConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>로그아웃 하시겠어요?</DialogTitle>
            <DialogDescription>
              로그아웃하면 다시 로그인해야 합니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='secondary'
              className='flex-1 h-12 rounded-lg'
              onClick={() => setIsLogoutConfirmOpen(false)}
            >
              아니요
            </Button>
            <Button
              className='flex-1 h-12 rounded-lg font-bold'
              onClick={async () => {
                setIsLogoutConfirmOpen(false);
                await executeLogout();
              }}
            >
              네
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
};
