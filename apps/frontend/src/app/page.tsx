import { Metadata } from 'next';
import { MainPage } from '@/components/main/MainPage';

export const metadata: Metadata = {
  title: '감옥 - 함께 만드는 집중 공간',
  description: '멤버들과 함께 공간을 만들어 집중 시간에 몰입하고 벌칙으로 동기를 더하세요.',
};

export default function Page() {
  return <MainPage />;
}
