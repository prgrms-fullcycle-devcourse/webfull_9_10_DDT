import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '감옥 - 디지털 디톡스 스페이스',
    short_name: '감옥',
    description: '딴짓하는 순간, 당신은 실패입니다. 가장 치열한 집중을 위한 효율적인 디지털 디톡스 타이머.',
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