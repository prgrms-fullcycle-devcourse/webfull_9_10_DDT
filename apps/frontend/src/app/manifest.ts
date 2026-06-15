import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '감옥 - 디지털 디톡스 타이머',
    short_name: '감옥',
    description: '남들이 딴짓할 때, 우리는 서로를 가두고 집중한다.',
    start_url: '/',
    display: 'standalone', // 브라우저 UI 없이 앱처럼 전체화면으로 실행
    background_color: '#050816', // globals.css의 --background 색상
    theme_color: '#050816',
    orientation: 'portrait', // 세로 모드 고정
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-1024x1024.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}