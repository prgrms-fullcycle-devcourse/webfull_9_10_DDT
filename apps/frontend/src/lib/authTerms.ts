export const PENDING_TERMS_KEY = 'pending_google_terms_agreement';
export const TERMS_LOGIN_RETURN_TO_KEY = 'terms_login_return_to';
export const TERMS_OAUTH_STARTED_KEY = 'terms_google_oauth_started';

export type TermsAgreement = {
  termsOfService: boolean;
  privacyPolicy: boolean;
  ageVerification: boolean;
};

export const EMPTY_TERMS_AGREEMENT: TermsAgreement = {
  termsOfService: false,
  privacyPolicy: false,
  ageVerification: false,
};

/**
 * 진행 중이던 약관 동의 상태를 sessionStorage에서 읽어온다. (구글 로그인 왕복 사이 보존용)
 *
 * @returns 저장된 동의 상태, 없거나 파싱 실패 시 null
 */
export const readPendingTerms = (): TermsAgreement | null => {
  if (typeof window === 'undefined') return null;

  try {
    const value = sessionStorage.getItem(PENDING_TERMS_KEY);
    if (!value) return null;

    const parsed = JSON.parse(value) as Partial<TermsAgreement>;
    return {
      termsOfService: !!parsed.termsOfService,
      privacyPolicy: !!parsed.privacyPolicy,
      ageVerification: !!parsed.ageVerification,
    };
  } catch {
    return null;
  }
};

/**
 * 필수 약관 3가지(서비스·개인정보·연령)에 모두 동의했는지 판별하는 타입 가드.
 *
 * @param value - 약관 동의 상태 (또는 null)
 * @returns 셋 다 true면 true (타입을 TermsAgreement로 좁힘)
 */
export const isCompleteTermsAgreement = (
  value: TermsAgreement | null,
): value is TermsAgreement =>
  !!value &&
  value.termsOfService &&
  value.privacyPolicy &&
  value.ageVerification;
