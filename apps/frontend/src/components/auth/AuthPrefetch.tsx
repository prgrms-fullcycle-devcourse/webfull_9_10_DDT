'use client';
import { useAuth } from '@/hooks/useAuth';

/**
 * 앱 최상단에 두어 로그인 사용자(me) 조회를 앱 시작 시 미리 트리거하는 컴포넌트.
 * useAuth를 호출해 캐시를 채우기만 하고 렌더링은 하지 않는다(null).
 */
export function AuthPrefetch() {
  useAuth();
  return null;
}
