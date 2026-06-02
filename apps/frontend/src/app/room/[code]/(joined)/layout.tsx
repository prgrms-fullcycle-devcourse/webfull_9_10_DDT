'use client';

import { RoomProvider, useRoom } from '@/contexts/RoomContext';
import { use, useEffect } from 'react';
import { getToken } from '@/lib/getToken';
import { SocketProvider } from '@/contexts/SocketContext';
import { RoomNotFound } from '@/components/room/RoomNotFound';

export default function JoinedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  useEffect(() => {
    sessionStorage.removeItem(`isHost:${code}`);
    sessionStorage.removeItem(`hostPassword:${code}`);
  }, [code]);

  return (
    <RoomProvider code={code}>
      <SocketWrapper>{children}</SocketWrapper>
    </RoomProvider>
  );
}

function SocketWrapper({ children }: { children: React.ReactNode }) {
  const room = useRoom();
  const token = getToken();

  if (!token) {
    return <RoomNotFound primaryMessage='로그인이 필요해요.' />;
  }

  return (
    <SocketProvider roomCode={room.code} token={token}>
      {children}
    </SocketProvider>
  );
}
