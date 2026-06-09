import { TermsPage } from '@/components/auth/TermsPage';

type TermsPageRouteProps = {
  searchParams: Promise<{
    mode?: string;
  }>;
};

export default async function Page({ searchParams }: TermsPageRouteProps) {
  const params = await searchParams;
  return <TermsPage isPopup={params.mode === 'popup'} />;
}
