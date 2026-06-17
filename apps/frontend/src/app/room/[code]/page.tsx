import { Metadata } from 'next';
import { JoinRoom } from '@/components/room/JoinRoom';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `방 입장하기 - ${code} | 감옥`,
    description: '초대받은 방에서 함께 집중해보세요!',
    openGraph: {
      title: `방 입장하기 - ${code} | 감옥`,
      description: '초대받은 방에서 함께 집중해보세요!',
      images: [
        {
          url: '/images/og-room-join.png',
          width: 512,
          height: 512,
          alt: '감옥 로고',
        },
      ], 
    },
  };
}

export default function JoinRoomPage() {
  return <JoinRoom />;
}