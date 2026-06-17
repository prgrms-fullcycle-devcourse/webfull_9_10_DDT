'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRoomApi } from '@/api/generated/room-api/room-api';
import { RoomNotFound } from '@/components/room/RoomNotFound';
import { RoomLoading } from '@/components/room/RoomLoading';
import { queryKeys } from '@/lib/queryKeys';

interface RoomContextValue {
  code: string;
  title: string;
  phase: string;
}

const RoomContext = createContext<RoomContextValue | null>(null);

/**
 * 방 기본 정보(code·title·phase)를 조회해 하위 트리에 제공하는 Provider.
 * 조회 중이면 RoomLoading, 없는/잘못된 방이면 RoomNotFound를 대신 렌더해
 * children은 항상 유효한 방 컨텍스트 위에서만 동작하도록 보장한다.
 *
 * @param code - 방 코드 (조회 키)
 * @param children - 방 컨텍스트를 사용할 하위 트리
 */
export function RoomProvider({
  code,
  children,
}: {
  code: string;
  children: ReactNode;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.room.detail(code),
    queryFn: async () => {
      const res = await getRoomApi().roomControllerFindById(code);
      return res.data as {
        title: string;
        id: string;
        phase: string;
        memberCount: number;
      };
    },
  });

  const value = useMemo<RoomContextValue | null>(() => {
    if (!data) return null;
    return {
      code: data.id,
      title: data.title,
      phase: data.phase,
    };
  }, [data]);

  if (isLoading) return <RoomLoading />;
  if (error || !value) return <RoomNotFound />;

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

/**
 * 현재 방 컨텍스트(code·title·phase)를 반환한다.
 * RoomProvider 밖에서 호출하면 에러를 던져 잘못된 사용을 컴파일 이후 즉시 드러낸다.
 *
 * @returns 현재 방 정보
 */
export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used inside RoomProvider');
  return ctx;
}
