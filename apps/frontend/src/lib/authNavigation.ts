import { isMobileOrTablet } from '@/lib/device';
import { PENDING_TERMS_KEY, TERMS_LOGIN_RETURN_TO_KEY } from '@/lib/authTerms';

const TERMS_POPUP_FEATURES =
  'width=390,height=730,resizable=no,status=no,toolbar=no,menubar=no,location=no';
const TERMS_POPUP_PATH = '/terms?mode=popup';

const getCurrentPath = () => {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
};

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
