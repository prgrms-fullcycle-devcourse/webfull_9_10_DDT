import { create } from 'zustand';

interface AuthState {
  isLoggedIn: boolean;
  checkLoginStatus: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  
  checkLoginStatus: () => {
    const hasToken = document.cookie.includes('access_token=');
    set({ isLoggedIn: hasToken });
  },

  logout: () => {
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    set({ isLoggedIn: false });
  }
}));