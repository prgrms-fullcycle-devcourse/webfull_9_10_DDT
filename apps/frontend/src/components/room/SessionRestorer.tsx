'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRoomApi } from '@/api/generated/room-api/room-api';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useConfirm } from '@/hooks/useConfirm';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/queryKeys';
import { clearGuestAccessToken } from '@/lib/authToken';

export function SessionRestorer() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { isLoggedIn, me } = useAuth();
  const { confirm, confirmProps } = useConfirm();

  const dismissedRoomsRef = useRef<Set<string>>(new Set());
  const isOnHomePage = pathname === '/';
  const {
    data: activeRoom,
    isError: isActiveRoomError,
    isFetched: isActiveRoomFetched,
  } = useQuery({
    queryKey: queryKeys.room.active(isLoggedIn, isOnHomePage),
    queryFn: async () => {
      const res = await getRoomApi().roomControllerGetMyActiveRoom();
      const data = (
        res as unknown as {
          data: { code: string; title: string; phase: string };
        }
      ).data;
      return data || null;
    },
    enabled: isLoggedIn && isOnHomePage,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  useEffect(() => {
    if (!isOnHomePage || me?.role !== 'guest' || !isActiveRoomFetched) {
      return;
    }

    if (isActiveRoomError || !activeRoom) {
      if (clearGuestAccessToken()) {
        queryClient.setQueryData(queryKeys.auth.me(), null);
      }
    }
  }, [
    activeRoom,
    isActiveRoomError,
    isActiveRoomFetched,
    isOnHomePage,
    me?.role,
    queryClient,
  ]);

  useEffect(() => {
    if (
      activeRoom?.code &&
      !dismissedRoomsRef.current.has(activeRoom.code) &&
      isOnHomePage
    ) {
      const promptRestore = async () => {
        const ok = await confirm({
          title: '진행 중인 집중 세션이 있습니다.',
          description: `[${activeRoom.title}] 방으로 복귀하시겠습니까?`,
          confirmText: '복귀하기',
          cancelText: '무시하기',
        });
        if (ok) {
          let targetPath = `/room/${activeRoom.code}/contract`;
          if (activeRoom.phase === 'timer') {
            targetPath = `/room/${activeRoom.code}/timer`;
          } else if (activeRoom.phase === 'result') {
            targetPath = `/room/${activeRoom.code}/semi-result`;
          }
          router.push(targetPath);
        } else {
          dismissedRoomsRef.current.add(activeRoom.code!);
        }
      };
      promptRestore();
    }
  }, [activeRoom, confirm, isOnHomePage, router]);

  return <ConfirmDialog {...confirmProps} />;
}
