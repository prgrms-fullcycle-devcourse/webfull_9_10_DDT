/**
 * 모바일/태블릿 환경 여부를 판별한다. 네이티브 공유 시트(navigator.share)를 띄울지 등 분기에 쓴다.
 * UA·userAgentData·터치 지원·coarse 포인터·뷰포트 폭을 종합 판단한다. (iPadOS 데스크톱 위장도 보강)
 *
 * @returns 모바일/태블릿으로 판단되면 true
 */
export const isMobileOrTablet = () => {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent.toLowerCase();
  const userAgentData = (
    navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  ).userAgentData;
  // iPadOS는 데스크톱 UA로 위장하므로 터치 지원 + macintosh 조합으로 보강 판별한다.
  const hasTouchScreen =
    navigator.maxTouchPoints > 1 && /macintosh/.test(userAgent);
  const hasCoarsePointer =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(pointer: coarse)').matches;
  const hasMobileViewport =
    typeof window !== 'undefined' && window.innerWidth <= 768;

  return (
    userAgentData?.mobile === true ||
    /android|iphone|ipad|ipod|mobile|tablet/.test(userAgent) ||
    hasTouchScreen ||
    hasCoarsePointer ||
    hasMobileViewport
  );
};
