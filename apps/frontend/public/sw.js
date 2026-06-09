// 오직 push 이벤트 리스너만 남김
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: '감옥 알림', body: '집중 시간이 시작되었습니다!' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
    })
  );
});

// 서비스 워커 즉시 활성화 (기존 버전을 밀어내기 위함)
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
