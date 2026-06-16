import { MobileLayout } from '@/components/layout/mobileLayout';
import { BackButton } from '@/components/layout/BackButton';
import { HeaderTitle } from '@/components/layout/HeaderTitle';

interface RoomLoadingProps {
  title?: string;
  message?: string;
}

/**
 * 방 데이터를 불러오는 동안 모바일 레이아웃(헤더 유지) 안에 표시하는 로딩 화면.
 * 헤더가 그대로 남아 로딩→본문 전환 시 레이아웃 점프가 없다.
 *
 * @param title - 헤더 제목 (기본 '방 입장하기')
 * @param message - 본문에 표시할 로딩 문구 (기본 '방 정보 불러오는 중...')
 */
export function RoomLoading({
  title = '방 입장하기',
  message = '방 정보 불러오는 중...',
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
