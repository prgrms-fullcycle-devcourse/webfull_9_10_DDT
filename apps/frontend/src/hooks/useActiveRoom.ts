'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRoomApi } from '@/api/generated/room-api/room-api';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/queryKeys';
import { clearGuestAccessToken } from '@/lib/authToken';

// getMyActiveRoom: 내 활성 방이 있는지 + code 식별용
interface ActiveRoomSummary {
  code: string;
  title: string;
  phase: string;
}

// GET /rooms/:code (find): 메인 현황 카드에 표시할 데이터
export interface ActiveRoomDetail {
  id: string;
  title: string;
  memberCount: number;
  phase: string;
  isHost: boolean;
}

/**
 * 진행 중인 방으로 복귀할 때 phase에 따라 이동할 경로를 반환한다.
 * - lobby(입장 전)    → 입장 페이지(JoinRoom)
 * - contract(계약서)  → 계약서 페이지
 * - timer(집중 중)    → 타이머 페이지
 */
export function getActiveRoomPath(room: ActiveRoomDetail): string {
  switch (room.phase) {
    case 'timer':
      return `/room/${room.id}/timer`;
    case 'contract':
      return `/room/${room.id}/contract`;
    case 'result':
      return `/room/${room.id}/semi-result`;
    case 'lobby':
    default:
      return `/room/${room.id}`;
  }
}

/**
 * 로그인 유저의 진행 중(참여 중)인 방을 조회한다.
 * 1) getMyActiveRoom 으로 활성 방 존재 여부 + code 확인
 * 2) /rooms/:code(find) 로 이름/멤버수/상태/방장여부 상세 조회
 * 게스트인데 활성 방이 없으면 게스트 토큰을 정리한다.
 */
export function useActiveRoom(): ActiveRoomDetail | null {
  const queryClient = useQueryClient();
  const { isLoggedIn, me } = useAuth();

  const {
    data: activeRoom,
    isError: isActiveRoomError,
    isFetched: isActiveRoomFetched,
  } = useQuery({
    queryKey: queryKeys.room.active(isLoggedIn, true),
    queryFn: async () => {
      const res = await getRoomApi().roomControllerGetMyActiveRoom();
      const data = (res as unknown as { data: ActiveRoomSummary | null }).data;
      return data || null;
    },
    enabled: isLoggedIn,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const activeCode = activeRoom?.code;

  const { data: roomDetail } = useQuery({
    queryKey: ['room', 'active-detail', activeCode],
    queryFn: async () => {
      const res = await getRoomApi().roomControllerFindById(activeCode!);
      return (res as unknown as { data: ActiveRoomDetail }).data;
    },
    enabled: !!activeCode,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  // 게스트인데 활성 방이 없으면 게스트 토큰을 정리한다. (기존 로직 유지)
  useEffect(() => {
    if (me?.role !== 'guest' || !isActiveRoomFetched) {
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
    me?.role,
    queryClient,
  ]);

  return roomDetail ?? null;
}
