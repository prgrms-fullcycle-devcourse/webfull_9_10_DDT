'use client';

import { useRoomStore } from '@/store/useRoomStore';
import { useRouter } from 'next/navigation';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

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

  useEffect(() => {
    if (socketRef.current?.connected) {
      return;
    }

    const s = io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080', {
      auth: { token },
      query: { roomCode },
      transports: ['polling', 'websocket'],
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
      console.warn('강제 연결 해제', data);
    });

    s.on('room:closed', ({ reason }: { reason?: string }) => {
      toast.error(reason ?? '방이 종료되었습니다.');
      useRoomStore.getState().reset();
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

    socketRef.current = s;
    setSocket(s);

    return () => {
      console.log('소켓 해제');
      s.off('room:closed');
      s.disconnect();
      useRoomStore.getState().reset();
      socketRef.current = null;
    };
  }, [roomCode, router, token]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const socket = useContext(SocketContext);
  return socket;
}
