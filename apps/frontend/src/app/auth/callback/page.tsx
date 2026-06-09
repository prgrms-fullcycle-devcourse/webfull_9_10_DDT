import { AuthCallbackPage } from '@/components/auth/AuthCallbackPage';
import { Suspense } from 'react';

export default function Page() {
  return (
    <Suspense>
      <AuthCallbackPage />
    </Suspense>
  );
}
