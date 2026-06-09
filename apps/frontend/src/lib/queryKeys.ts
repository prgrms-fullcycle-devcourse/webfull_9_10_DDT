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
