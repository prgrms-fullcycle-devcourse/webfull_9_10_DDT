'use client';

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';

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

  useEffect(() => {
    if (socketRef.current?.connected) {
      return;
    }

    const s = io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080', {
      auth: { token },
      query: { roomCode },
      transports: ['websocket'],
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

    socketRef.current = s;
    setSocket(s);

    return () => {
      console.log('소켓 해제');
      s.disconnect();
      socketRef.current = null;
    };
  }, [roomCode, token]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const socket = useContext(SocketContext);
  return socket;
}
