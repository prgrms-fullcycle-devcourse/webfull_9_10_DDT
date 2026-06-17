import { isMobileOrTablet } from '@/lib/device';
import { PENDING_TERMS_KEY, TERMS_LOGIN_RETURN_TO_KEY } from '@/lib/authTerms';

const TERMS_POPUP_FEATURES =
  'width=390,height=730,resizable=no,status=no,toolbar=no,menubar=no,location=no';
const TERMS_POPUP_PATH = '/terms?mode=popup';

const getCurrentPath = () => {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
};

/**
 * 약관 동의 → 구글 로그인 플로우를 시작한다.
 * 로그인 성공 후 돌아올 경로(returnTo)를 sessionStorage에 저장하고,
 * 모바일/태블릿은 같은 탭으로 이동, 데스크탑은 팝업 창으로 약관 화면을 연다.
 *
 * @param redirect - 라우터 이동 함수 (모바일에서 사용, 예: router.push)
 * @param returnTo - 로그인 후 복귀 경로 (생략 시 현재 경로)
 */
export const startTermsAgreementLogin = (
  redirect: (path: string) => void,
  returnTo?: string,
) => {
  if (typeof window === 'undefined') return;

  sessionStorage.removeItem(PENDING_TERMS_KEY);
  sessionStorage.setItem(TERMS_LOGIN_RETURN_TO_KEY, returnTo ?? getCurrentPath());

  if (isMobileOrTablet()) {
    redirect('/terms?clear=true');
    return;
  }

  window.open(`${TERMS_POPUP_PATH}&clear=true`, 'Terms Agreement', TERMS_POPUP_FEATURES);
};
