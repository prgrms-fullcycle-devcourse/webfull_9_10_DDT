import { LegalDocument } from '@/components/auth/LegalDocument';
import { PRIVACY_POLICY } from '@/lib/termsContent';

export default function Page() {
  return <LegalDocument document={PRIVACY_POLICY} />;
}
