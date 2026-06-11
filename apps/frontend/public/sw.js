/// <reference lib="webworker" />

/**
 * @type {ServiceWorkerGlobalScope}
 */
const sw = self;

sw.addEventListener('install', () => {
  sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(sw.clients.claim());
});

// 푸시 알림 수신 이벤트
sw.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    /** @type {{title?: string, body?: string}} */
    const data = event.data.json();
    
    const title = data.title || '감옥 - 타이머 알림';
    const options = {
      body: data.body || '새로운 알림이 도착했습니다.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
    };

    event.waitUntil(sw.registration.showNotification(title, options));
  } catch (error) {
    console.error('푸시 알림 파싱 실패:', error);
  }
});

// 푸시 알림 클릭 이벤트
sw.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    sw.clients.matchAll({ type: 'window' }).then((clientList) => {
      // 앱이 이미 열려있다면 포커스
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      // 열려있지 않다면 새 창(또는 탭)으로 열기
      if (sw.clients.openWindow) {
        return sw.clients.openWindow('/');
      }
    })
  );
});