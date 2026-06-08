'use client';

import { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
  const router = useRouter();
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

  useEffect(() => {
    // 💡 방 정보 조회 후 phase가 timer라면 진입 차단
    if (data?.phase === 'timer') {
      toast.error('이미 집중 세션이 시작된 방입니다.');
      router.replace('/');
    }
  }, [data, router]);

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
