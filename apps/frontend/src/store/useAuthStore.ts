// src/store/useAuthStore.ts
import { getUsers } from '@/api/generated/users-사용자/users-사용자';
import { getToken } from '@/lib/getToken';
import { jwtDecode } from 'jwt-decode';
import { create } from 'zustand';

interface JwtPayload {
  sub: string;
  role: string;
  exp?: string;
}

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

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  me: null,

  setMe: (me) => set({ me, isLoggedIn: true }),

  fetchMe: async () => {
    const token = getToken();

    if (!token) {
      set({ isLoggedIn: false, me: null });
      return;
    }

    let payload: JwtPayload;
    try {
      payload = jwtDecode<JwtPayload>(token);
    } catch {
      set({ isLoggedIn: false, me: null });
      return;
    }

    if (payload.role === 'guest') {
      set({
        me: {
          id: payload.sub,
          nickname: '게스트',
          profileImage: 'basic_image_key_01',
          role: 'guest',
        },
        isLoggedIn: true,
      });
      return;
    }

    try {
      const res = await getUsers().usersControllerGetMe();
      const data = res.data as {
        userId: string;
        nickname: string;
        email: string;
        profileImage: string;
      };
      set({
        me: {
          id: data.userId,
          nickname: data.nickname,
          profileImage: data.profileImage,
          role: 'user',
        },
        isLoggedIn: true,
      });
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
