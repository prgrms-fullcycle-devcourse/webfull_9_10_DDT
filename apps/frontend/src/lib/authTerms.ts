export const PENDING_TERMS_KEY = 'pending_google_terms_agreement';
export const TERMS_LOGIN_RETURN_TO_KEY = 'terms_login_return_to';

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

export const readPendingTerms = (): TermsAgreement | null => {
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

export const isCompleteTermsAgreement = (
  value: TermsAgreement | null,
): value is TermsAgreement =>
  !!value &&
  value.termsOfService &&
  value.privacyPolicy &&
  value.ageVerification;
