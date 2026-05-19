'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function Home() {
  const socketRef = useRef<Socket | null>(null);
  const [message, setMessage] = useState('서버 연결 대기 중...');

  useEffect(() => {
    // 1. 소켓 연결
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8080';
    socketRef.current = io(socketUrl); 

    // 2. 이벤트 리스너 등록 
    socketRef.current.on('welcome', (data) => setMessage(data.message));
    socketRef.current.on('pong', (data) => alert(data));

    // 3. 컴포넌트 언마운트 시 소켓 닫기
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const sendPing = () => {
    socketRef.current?.emit('ping', '프론트가 찌릅니다!'); 
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-zinc-900 text-white">
      <h1 className="text-4xl font-bold mb-4">DDT V2 실시간 소켓 테스트</h1>
      <p className="text-xl mb-8 text-green-400">{message}</p>
      
      <button 
        onClick={sendPing}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
      >
        서버 찌르기 (Ping 쏘기)
      </button>
    </main>
  );
}