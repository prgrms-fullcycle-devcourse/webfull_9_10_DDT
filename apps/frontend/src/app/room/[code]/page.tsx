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
    description: '초대받은 방에 입장해서 함께 집중해보세요!',
    openGraph: {
      title: `방 입장하기 - ${code} | 감옥`,
      description: '초대받은 방에 입장해서 함께 집중해보세요!',
      images: ['/icons/icon-512x512.png'], 
    },
  };
}

export default function JoinRoomPage() {
  return <JoinRoom />;
}