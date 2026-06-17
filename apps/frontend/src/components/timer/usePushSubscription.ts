import { useEffect } from 'react';
import axios from 'axios';
import { urlBase64ToUint8Array } from '@/lib/utils';
import { getToken } from '@/lib/getToken';

/**
 * 웹푸시 구독을 생성/조회해 서버에 등록하는 훅. (휴식 종료 1분 전 알림 등 발송용)
 * 지원 환경 + 알림 권한이 허용된 경우에만 동작하며, 기존 구독이 있으면 재사용한다.
 *
 * @param roomCode - 구독을 등록할 방 코드
 */
export function usePushSubscription(roomCode: string) {
  useEffect(() => {
    async function subscribeToPush() {
      // 서비스워커·PushManager 미지원이거나 알림 권한이 없으면 조용히 건너뛴다.
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
