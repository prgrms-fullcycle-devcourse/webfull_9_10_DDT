import { RequireAuth } from '@/components/auth/RequireAuth';
import { MyPage } from '@/components/mypage/MyPage';

export default function MyPageRoute() {
  return (
    <RequireAuth>
      <MyPage />
    </RequireAuth>
  );
}
