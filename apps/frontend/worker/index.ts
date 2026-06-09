/// <reference lib="webworker" />

export {};

// ServiceWorker 전역 스코프로 self를 단언합니다.
declare const self: ServiceWorkerGlobalScope;

self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() ?? {};
  const title = data.title || '감옥 집중 시간 알림';
  const options = {
    body: data.body || '곧 집중 시간이 시작됩니다!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [200, 100, 200], // 징- 징- 진동
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 알림을 클릭했을 때 현재 열려있는 탭으로 이동시키는 로직
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
