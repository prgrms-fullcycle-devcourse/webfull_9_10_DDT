'use client';

import { RoomProvider, useRoom } from '@/contexts/RoomContext';
import { use } from 'react';
import { getToken } from '@/lib/getToken';
import { SocketProvider } from '@/contexts/SocketContext';

export default function JoinedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

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
    return <div>인증 정보 없음</div>;
  }

  return (
    <SocketProvider roomCode={room.code} token={token}>
      {children}
    </SocketProvider>
  );
}
