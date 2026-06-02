import { LegalDocument } from '@/components/auth/LegalDocument';
import { SERVICE_TERMS } from '@/lib/termsContent';

export default function Page() {
  return <LegalDocument document={SERVICE_TERMS} />;
}
