// 모바일/태블릿 환경 여부. 네이티브 공유 시트(navigator.share)를 띄울지 판단하는 데 쓴다.
export const isMobileOrTablet = () => {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent.toLowerCase();
  // iPadOS는 데스크톱 UA로 위장하므로 터치 지원 + macintosh 조합으로 보강 판별한다.
  const hasTouchScreen =
    navigator.maxTouchPoints > 1 && /macintosh/.test(userAgent);

  return (
    /android|iphone|ipad|ipod|mobile|tablet/.test(userAgent) || hasTouchScreen
  );
};
