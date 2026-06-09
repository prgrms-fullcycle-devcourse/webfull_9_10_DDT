import { Metadata } from 'next';
import { TotalResult } from '@/components/room/TotalResult';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `통합 결과 - ${code} | 감옥`,
    description: '집중 세션 결과를 확인해보세요!',
    openGraph: {
      title: `통합 결과 - ${code} | 감옥`,
      description: '집중 세션 결과를 확인해보세요!',
    },
  };
}

export default function TotalResultPage() {
  return <TotalResult />;
}