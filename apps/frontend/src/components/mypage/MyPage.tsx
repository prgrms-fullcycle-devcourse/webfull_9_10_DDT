'use client';

import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Clock3 } from 'lucide-react';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { HomeButton } from '@/components/layout/HomeButton';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MyPageSettings } from '@/components/mypage/MyPageSettings';
import { MyPageHistoryList, HistoryItem } from '@/components/mypage/MyPageHistoryList';
import { useAuthStore } from '@/store/useAuthStore';
import { formatDuration } from '@/lib/format';
import { DEFAULT_PROFILE_IMAGE_KEY, getProfileImageSrc } from '@/lib/profileImage';
import { getUsers } from '@/api/generated/users-사용자/users-사용자';
import { getAuthApi } from '@/api/generated/인증-auth-api/인증-auth-api';

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

type ApiEnvelope<T> = {
  data?: T;
};

const emptyStats: UserStats = {
  totalRoomCount: 0,
  totalFocusMs: 0,
  totalEscapeMs: 0,
};

const getCookieToken = () => {
  if (typeof document === 'undefined') return undefined;
  return document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/)?.[1];
};


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
  const { logout } = useAuthStore();

  useEffect(() => {
    const token = getCookieToken();
    if (!token) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const axiosInstance = axios.create({ baseURL: apiUrl });
    const usersApi = getUsers(axiosInstance);

    const loadProfile = async () => {
      setIsLoadingProfile(true);

      try {
        const response = await usersApi.usersControllerGetMe({
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = response.data as ApiEnvelope<UserProfile>;
        setProfile(result.data ?? null);
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
          usersApi.usersControllerGetMyStats({
            headers: { Authorization: `Bearer ${token}` },
          }),
          usersApi.usersControllerGetMyHistory({ limit: 3 }, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const statsResult = statsResponse.data as ApiEnvelope<UserStats>;
        setStats(statsResult.data ?? emptyStats);

        const historyResult = historyResponse.data as ApiEnvelope<{
          sessions?: HistoryItem[];
        }>;
        setHistory(historyResult.data?.sessions?.slice(0, 3) ?? []);
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
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
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
    const token = getCookieToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

    if (token) {
      const axiosInstance = axios.create({ baseURL: apiUrl });
      const authApi = getAuthApi(axiosInstance);
      await authApi.authControllerLogout({
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }

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
    ? getProfileImageSrc(profile.profileImage) ?? getProfileImageSrc(DEFAULT_PROFILE_IMAGE_KEY)
    : undefined;

  return (
    <MobileLayout
      header={
        <>
          <HomeButton />
          <HeaderTitle>마이 페이지</HeaderTitle>
           <div className="flex-1" />
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
              <p className='truncate text-[14px] leading-5 text-[#81808D]'>{profile.email}</p>
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
        href='/room'
        className='mb-4 flex h-[51px] w-full items-center justify-center rounded-[14px] border border-[#914CFF] bg-[#242136] text-[15px] font-bold text-white/90 transition hover:bg-[#2A2640]'
      >
        새로운 방 만들기
      </Link>

      <section className='mb-12 grid h-[140px] grid-cols-2 grid-rows-2 gap-2'>
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={`relative overflow-hidden rounded-[12px] px-3 py-4 ${card.className}`}
          >
            <p className='text-center text-[11px] font-medium text-[#767481]'>{card.label}</p>
            <p className='mt-1 text-center text-[18px] font-extrabold leading-7 text-white/90'>
              {card.value}
            </p>
            {card.icon ? (
              <Clock3
                className='absolute -bottom-[28px] left-1/2 size-[78px] -translate-x-1/2 text-white/10'
                strokeWidth={2.6}
              />
            ) : null}
          </div>
        ))}
      </section>

      <section>
        <div className='mb-3 flex items-center justify-between'>
          <h2 className='text-[14px] font-medium text-[#898793]'>최근 참여 기록</h2>
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
        />
      </section>

      <Dialog open={isLogoutConfirmOpen} onOpenChange={setIsLogoutConfirmOpen}>
        <DialogContent className='bg-[#141A2B] border-white/10 rounded-2xl'>
          <DialogHeader>
            <DialogTitle>로그아웃 하시겠어요?</DialogTitle>
            <DialogDescription className='text-[#D3D3E3]'>로그아웃하면 다시 로그인해야 합니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter className='flex gap-3 pt-3'>
            <Button
              variant='outline'
              className='flex-1 h-12 rounded-[14px] border-white/[0.18] text-white/80 bg-transparent hover:bg-white/5'
              onClick={() => setIsLogoutConfirmOpen(false)}
            >
              아니요
            </Button>
            <Button
              className='flex-1 h-12 rounded-[14px] font-bold text-white'
              style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)' }}
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
