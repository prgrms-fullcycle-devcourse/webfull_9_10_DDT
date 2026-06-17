import { ReactNode } from 'react';

interface MobileLayoutProps {
  header: ReactNode;
  children: ReactNode;
  bottomButton?: ReactNode;
  /** true면 하단 슬롯의 기본 chrome(테두리/배경)을 제거해, 호출부가 그라데이션 등 자체 스타일을 입힐 수 있다. */
  bottomFloating?: boolean;
}

/**
 * 모든 화면의 공통 모바일 레이아웃. sticky 헤더 + 스크롤 본문 + (선택) sticky 하단 버튼 영역으로 구성된다.
 * 데스크탑에서는 RootLayout이 이 컬럼을 가운데 좁은 폭으로 감싼다.
 *
 * @param header - 헤더 영역에 들어갈 내용 (뒤로가기·제목 등)
 * @param children - 스크롤되는 본문
 * @param bottomButton - 하단 고정 버튼 영역 내용 (없으면 영역 미표시)
 * @param bottomFloating - true면 하단 슬롯의 기본 chrome(테두리/배경)을 제거해 호출부가 자체 스타일을 입힐 수 있다
 */
export const MobileLayout = ({
  header,
  children,
  bottomButton,
  bottomFloating = false,
}: MobileLayoutProps) => {
  return (
    <div className='relative flex min-h-dvh flex-col overflow-x-clip'>
      {/* sticky: 부모 컨테이너 흐름 안에 있어, 모달 열림 시 스크롤바 변화로 헤더가 틀어지지 않는다 */}
      <header className='sticky top-0 z-50 flex h-[58px] shrink-0 items-center border-b border-border bg-background px-4'>
        {header}
      </header>

      <main className='flex-1 overflow-x-hidden px-4 py-4'>{children}</main>

      {bottomButton ? (
        bottomFloating ? (
          <div className='sticky bottom-0 z-50 shrink-0'>{bottomButton}</div>
        ) : (
          <div className='sticky bottom-0 z-50 flex min-h-20 shrink-0 items-center border-t border-border bg-background px-4 py-3'>
            {bottomButton}
          </div>
        )
      ) : null}
    </div>
  );
};
