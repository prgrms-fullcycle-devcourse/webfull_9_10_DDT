'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRoomApi } from '@/api/generated/room-api/room-api';

interface RoomContextValue {
  code: string;
  title: string;
  phase: string;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({
  code,
  children,
}: {
  code: string;
  children: ReactNode;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['room', code],
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

  if (isLoading) return <div>로딩...</div>;
  if (error || !value) return <div>방 정보 조회 실패</div>;

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used inside RoomProvider');
  return ctx;
}
