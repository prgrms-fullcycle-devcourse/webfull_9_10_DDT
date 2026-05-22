'use client';
import { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export default function GoogleLoginButton() {
  const { checkLoginStatus } = useAuthStore();

  useEffect(() => {
    const receiveMessage = (event: MessageEvent) => {
      if (event.origin !== process.env.NEXT_PUBLIC_API_URL) return;

      if (event.data?.type === 'OAUTH_SUCCESS') {
        const token = event.data.token;
        document.cookie = `access_token=${token}; path=/; max-age=${60 * 60 * 24}`;
        checkLoginStatus();
      }
    };

    window.addEventListener('message', receiveMessage);
    return () => window.removeEventListener('message', receiveMessage);
  }, [checkLoginStatus]);

  const handleGoogleLogin = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    window.open(
      `${apiUrl}/auth/google`,
      'Google Login',
      'width=500,height=600,left=200,top=200'
    );
  };

  return (
    <button onClick={handleGoogleLogin} className="...">
      구글 계정으로 감옥 입장하기
    </button>
  );
}