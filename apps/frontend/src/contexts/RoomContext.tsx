'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRoomApi } from '@/api/generated/room-api/room-api';
import { RoomNotFound } from '@/components/room/RoomNotFound';
import { RoomLoading } from '@/components/room/RoomLoading';

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

  if (isLoading) return <RoomLoading />;
  if (error || !value) return <RoomNotFound />;

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used inside RoomProvider');
  return ctx;
}
