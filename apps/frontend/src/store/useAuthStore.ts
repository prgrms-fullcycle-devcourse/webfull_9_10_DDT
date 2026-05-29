// src/store/useAuthStore.ts
import { getUsers } from '@/api/generated/users-사용자/users-사용자';
import { create } from 'zustand';

interface Me {
  id: string;
  nickname: string;
  profileImage: string;
  role: 'user' | 'guest';
}

interface AuthState {
  isLoggedIn: boolean;
  me: Me | null;

  setMe: (me: Me) => void;
  fetchMe: () => Promise<void>;
  checkLoginStatus: () => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: false,
  me: null,

  setMe: (me) => set({ me, isLoggedIn: true }),

  fetchMe: async () => {
    const hasToken = document.cookie.includes('access_token=');
    if (!hasToken) {
      set({ isLoggedIn: false, me: null });
      return;
    }

    try {
      const res = await getUsers().usersControllerGetMe();
      const me = res.data as Me;
      set({ me, isLoggedIn: true });
    } catch {
      // 토큰 만료 등
      set({ isLoggedIn: false, me: null });
    }
  },

  checkLoginStatus: () => {
    const hasToken = document.cookie.includes('access_token=');
    set({ isLoggedIn: hasToken });
    return hasToken;
  },

  logout: () => {
    document.cookie =
      'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    set({ isLoggedIn: false, me: null });
  },
}));
