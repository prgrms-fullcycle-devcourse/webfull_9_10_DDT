import { TotalResult } from '@/components/room/result/TotalResult';
import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `수감 결과 - ${code} | 감옥`,
    description: '수감 결과를 확인해보세요!',
    openGraph: {
      title: `수감 결과 - ${code} | 감옥`,
      description: '수감 결과를 확인해보세요!',
      images: [
        {
          url: `/room/${code}/total-result/opengraph-image`,
          width: 1200,
          height: 630,
          alt: '수감 결과 | 감옥',
        },
      ],
    },
  };
}

export default function TotalResultPage() {
  return <TotalResult />;
}
