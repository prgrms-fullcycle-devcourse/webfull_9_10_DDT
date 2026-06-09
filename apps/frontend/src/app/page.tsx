import { Metadata } from 'next';
import { MainPage } from '@/components/main/MainPage';

export const metadata: Metadata = {
  title: '감옥 - 함께 만드는 집중 시간',
  description: '친구들과 함께 방을 만들어 집중 시간을 관리하고 벌칙으로 자극을 더하세요.',
};

export default function Page() {
  return <MainPage />;
}
