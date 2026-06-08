'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

interface SyncData {
  timeLeft: number;
  mode: 'FOCUS' | 'BREAK';
  currentSession: number;
}

export function useTimerSync(roomCode: string, identifier: string) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [mode, setMode] = useState<'FOCUS' | 'BREAK'>('FOCUS');
  const [currentSession, setCurrentSession] = useState(1);
  const [isSynced, setIsSynced] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('ddt_active_session', JSON.stringify({ roomCode, identifier }));

    const socket = io(
      process.env.NEXT_PUBLIC_API_URL || 'http://ddt-test.ddns.net:8080',
      {
        query: { roomCode, token: identifier },
        transports: ['websocket'],
      },
    );

    socketRef.current = socket;

    const heartbeatTimer = setInterval(() => {
      socket.emit('heartbeat', { roomCode, identifier });
    }, 5000);

    socket.on('session:sync', (data: SyncData) => {
      setTimeLeft(data.timeLeft);
      setMode(data.mode);
      setCurrentSession(data.currentSession);
      setIsSynced(true);
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (modeRef.current === 'FOCUS') {
          socket.emit('escape:start', { roomCode, identifier });
          toast.error('화면을 이탈했습니다! 벌칙 시간이 누적됩니다.', { duration: 3000 });
        }
      } else {
        if (modeRef.current === 'FOCUS') {
          socket.emit('escape:end', { roomCode, identifier });
          socket.emit('request:sync', { roomCode }); 
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomCode, identifier]);

  useEffect(() => {
    if (mode === 'BREAK' && timeLeft === 60) {
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 500]);
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('휴식 시간이 1분 남았습니다. 자리로 돌아와주세요.');
        utterance.lang = 'ko-KR';
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [mode, timeLeft]);

  return { timeLeft, mode, currentSession, isSynced };
}
