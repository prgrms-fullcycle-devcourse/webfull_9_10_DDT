'use client';

import { useRoomStore } from '@/store/useRoomStore';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { clearGuestAccessToken } from '@/lib/authToken';
import { queryKeys } from '@/lib/queryKeys';

const SocketContext = createContext<Socket | null>(null);

interface SocketProviderProps {
  roomCode: string;
  token: string;
  children: ReactNode;
}

export function SocketProvider({
  roomCode,
  token,
  children,
}: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const clearGuestSession = useCallback(() => {
    if (clearGuestAccessToken()) {
      queryClient.setQueryData(queryKeys.auth.me(), null);
    }
  }, [queryClient]);

  useEffect(() => {
    if (socketRef.current?.connected) {
      return;
    }

    const s = io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080', {
      auth: { token },
      query: { roomCode },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {
      console.log('연결 성공: ', s.id);
    });

    s.on('connect_error', (error) => {
      console.error('소켓 연결 실패: ', error.message);
    });

    s.on('disconnect', (reason) => {
      console.log('소켓 끊김: ', reason);
    });

    s.on('force-disconnect', (data) => {
      if (data.reason === 'not-a-member') {
        toast.error('방에 참여하지 않으셨습니다.');
        router.replace(`/room/${roomCode}`);
      } else if (data.reason === 'room-timer') {
        toast.error('이미 집중 페이즈입니다.');
        clearGuestSession();
        router.replace('/');
      } else if (data.reason === 'room-closed') {
        toast.error('이미 종료된 방입니다.');
        clearGuestSession();
        router.replace('/');
      } else if (data.reason === 'duplicate-connection') {
        toast.error('다른 곳에서 접속했습니다.');
        sessionStorage.setItem('duplicate-kicked', roomCode);
        clearGuestSession();
        router.replace('/');
      }
    });

    s.on('room:closed', ({ reason }: { reason?: string }) => {
      toast.error(reason ?? '방이 종료되었습니다.');
      useRoomStore.getState().reset();
      clearGuestSession();
      router.replace('/');
    });

    s.on('room:state', (state) => {
      useRoomStore.getState().setState({
        hostId: state.hostId,
        members: state.members,
        phase: state.phase,
      });
    });

    s.on('member:joined', (member) => {
      useRoomStore.getState().upsertMember(member.userId, {
        ...member,
        connected: true,
      });
    });

    s.on('member:left', ({ userId }) => {
      useRoomStore.getState().removeMember(userId);
    });

    s.on('member:kicked', ({ targetId }) => {
      useRoomStore.getState().removeMember(targetId);
    });

    s.on('kicked', () => {
      toast.error('방장에 의해 강퇴되었습니다.');
      clearGuestSession();
      router.replace('/');
    });

    s.on('sign:updated', ({ userId, signed }) => {
      if (userId) {
        useRoomStore.getState().upsertMember(userId, { isSigned: signed });
      }
    });

    s.on('sign:reset', () => {
      const members = useRoomStore.getState().members;
      Object.keys(members).forEach((id) => {
        useRoomStore.getState().upsertMember(id, { isSigned: false });
      });
    });

    s.on(
      'escape:summary',
      ({
        members,
      }: {
        members: { identifier: string; totalEscapeMs: number }[];
      }) => {
        useRoomStore.getState().setEscapeSummary(members);
      },
    );

    s.on('edit:updated', ({ targetId, canEdit }) => {
      useRoomStore.getState().upsertMember(targetId, { canEdit });
    });

    s.on('edit:all-updated', ({ canEdit }) => {
      const members = useRoomStore.getState().members;
      Object.keys(members).forEach((id) => {
        const isHost = members[id].isHost;
        if (!isHost) {
          useRoomStore.getState().upsertMember(id, { canEdit });
        }
      });
    });

    s.on(
      'session:started',
      (data: {
        startedAt: string;
        focusMin: number;
        breakMin: number;
        totalRounds: number;
        serverTime: string;
      }) => {
        const clientNow = Date.now();
        const serverNow = new Date(data.serverTime).getTime();

        useRoomStore.getState().setState({ phase: 'timer' });
        useRoomStore.getState().setSessionInfo({
          startedAt: new Date(data.startedAt).getTime(),
          focusMin: data.focusMin,
          breakMin: data.breakMin,
          totalRounds: data.totalRounds,
          serverOffset: serverNow - clientNow,
        });
      },
    );

    s.on('session:ended', () => {
      useRoomStore.getState().setState({ phase: 'result' });
      useRoomStore.getState().setSessionInfo(null);
    });

    s.on('member:gave-up', ({ userId, gaveUpAt }) => {
      useRoomStore.getState().upsertMember(userId, { gaveUpAt });
    });

    socketRef.current = s;
    setSocket(s);

    return () => {
      console.log('소켓 해제');
      s.off('room:closed');
      s.disconnect();
      useRoomStore.getState().reset();
      socketRef.current = null;
    };
  }, [clearGuestSession, roomCode, router, token]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const socket = useContext(SocketContext);
  return socket;
}
