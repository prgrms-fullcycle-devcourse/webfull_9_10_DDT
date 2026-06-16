import { useEffect } from 'react';
import axios from 'axios';
import { urlBase64ToUint8Array } from '@/lib/utils';
import { getToken } from '@/lib/getToken';

export function usePushSubscription(roomCode: string) {
  useEffect(() => {
    async function subscribeToPush() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      try {
        if (Notification.permission !== 'granted') return;

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!publicVapidKey) return;
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
          });
        }

        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/rooms/${roomCode}/push-subscription`,
          {
            subscription: subscription,
            platform: 'web',
          },
          {
            headers: {
              Authorization: `Bearer ${getToken() ?? ''}`,
            },
          },
        );
      } catch (error) {
        console.error('푸시 알림 설정 실패:', error);
      }
    }
    subscribeToPush();
  }, [roomCode]);
}
