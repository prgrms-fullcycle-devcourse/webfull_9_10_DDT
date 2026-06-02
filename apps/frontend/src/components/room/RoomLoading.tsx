import { MobileLayout } from '@/components/layout/mobileLayout';
import { BackButton } from '@/components/layout/BackButton';
import { HeaderTitle } from '@/components/layout/HeaderTitle';

interface RoomLoadingProps {
  title?: string;
  message?: string;
}

export function RoomLoading({
  title = '방 입장하기',
  message = '방 정보를 불러오는 중...',
}: RoomLoadingProps) {
  return (
    <MobileLayout
      header={
        <>
          <BackButton />
          <HeaderTitle>{title}</HeaderTitle>
        </>
      }
    >
      <div className='pt-16 text-center text-sm text-white/50'>{message}</div>
    </MobileLayout>
  );
}
