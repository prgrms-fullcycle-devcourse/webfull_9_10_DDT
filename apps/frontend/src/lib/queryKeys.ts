// React Query 키를 한곳에서 관리하는 팩토리. 캐시 키의 오타·불일치를 막고
// 무효화(invalidate) 시 동일한 키를 재사용하기 위해 모든 쿼리 키를 여기서 생성한다.
export const queryKeys = {
  auth: {
    all: () => ['auth'] as const,
    me: () => [...queryKeys.auth.all(), 'me'] as const,
  },

  room: {
    all: () => ['room'] as const,
    detail: (code: string) => [...queryKeys.room.all(), code] as const,
    active: (isLoggedIn: boolean, isOnHomePage: boolean) =>
      [...queryKeys.room.all(), 'active', isLoggedIn, isOnHomePage] as const,
  },

  result: {
    all: () => ['result'] as const,
    detail: (code: string) => [...queryKeys.result.all(), code] as const,
    giveUp: (code: string) =>
      [...queryKeys.result.all(), 'give-up', code] as const,
  },

  rules: {
    all: () => ['rules'] as const,
    saved: () => [...queryKeys.rules.all(), 'saved'] as const,
  },
} as const;
