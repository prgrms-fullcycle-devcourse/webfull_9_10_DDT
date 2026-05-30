'use client';
/*
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation'; 
import { Button } from '@/components/ui/button';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { TimerProgressBar } from '@/components/ui/timerprogressbar';
import { TimerCircle } from '@/components/ui/timercircle';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
// import { useTimerSync } from '@/hooks/useTimerSync'; 

const API_DATA = { //api로 교체
  focusDuration: 5,
  breakDuration: 3,
  totalSessions: 4,
};
*/

export default function ImprisonmentPage() {
  /*
  const router = useRouter();
  const params = useParams();
  
  const roomCode = params.id as string;
  const identifier = typeof document !== 'undefined' ? 
    (document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/)?.[1] || 'guest_token') : '';

  const { timeLeft, mode, currentSession } = useTimerSync(roomCode, identifier);
  
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const totalSessions = API_DATA.totalSessions;
  const isFocus = mode === 'FOCUS';
  
  const getDuration = (targetMode: 'FOCUS' | 'BREAK') => {
    return targetMode === 'FOCUS' ? API_DATA.focusDuration : API_DATA.breakDuration;
  };
  const totalDuration = getDuration(mode);

  const handleForfeit = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      await fetch(`${apiUrl}/rooms/${roomCode}/give-up`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${identifier}`,
          'X-Guest-Token': identifier 
        }
      });
      
      localStorage.removeItem('ddt_active_session');
      setIsModalOpen(false);
      router.push(`/result/${roomCode}`);
    } catch (error) {
      console.error('포기 처리 실패:', error);
    }
  };

  const theme = {
    textColor: isFocus ? 'text-primary' : 'text-success',
    strokeColor: isFocus ? 'stroke-primary' : 'stroke-success',
    statusText: isFocus ? '집중 시간' : '휴식 시간',
    subStatusText: isFocus ? '집중 중' : '휴식 중',
  };

  const HeaderComponent = (
    <div className='w-full text-center'>
      <h1 className={`text-xl font-bold ${theme.textColor}`}>
        {theme.statusText} {currentSession}/{totalSessions}
      </h1>
    </div>
  );

  const BottomButtonComponent = (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button className='w-full py-4 bg-transparent border border-border text-muted-foreground rounded-xl hover:bg-muted/30 transition-colors'>
          중도 포기
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-[320px] rounded-2xl border border-border bg-[#1E2538] p-6 text-white shadow-2xl focus:outline-none'>
        <DialogHeader className='text-left space-y-2'>
          <DialogTitle className='text-base font-bold leading-snug tracking-tight text-white'>
            포기하면 남은 시간이<br />모두 이탈 시간으로 처리돼요.
          </DialogTitle>
          <DialogDescription className='text-xs text-slate-400 font-medium leading-relaxed pt-0.5'>
            가장 많은 벌칙을 받게 됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className='flex gap-2.5 mt-6 w-full'>
          <Button
            onClick={handleForfeit}
            className='flex-1 py-5 bg-[#F85A5A] hover:bg-[#E04F4F] text-white font-bold rounded-xl transition-colors border-none'
          >
            포기하기
          </Button>
          <Button
            onClick={() => setIsModalOpen(false)}
            className='flex-1 py-5 bg-[#2A314A] hover:bg-[#353D5C] text-white font-bold rounded-xl transition-colors border-none'
          >
            취소
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className='min-h-screen bg-background text-foreground font-sans'>
      <MobileLayout
        header={HeaderComponent}
        bottomButton={BottomButtonComponent}
      >
        <div className='flex flex-col items-center justify-center w-full py-6'>
          <TimerProgressBar
            mode={mode}
            currentSession={currentSession}
            totalSessions={totalSessions}
            timeLeft={timeLeft}
            totalDuration={totalDuration}
            focusDuration={API_DATA.focusDuration}
            breakDuration={API_DATA.breakDuration}
          />

          <TimerCircle
            timeLeft={timeLeft}
            totalDuration={totalDuration}
            strokeColor={theme.strokeColor}
            subStatusText={theme.subStatusText}
          />

          {!isFocus && (
            <div className='text-center mt-10 w-full max-w-sm'>
              <p className='text-xs text-muted-foreground mb-1'>총 이탈 시간</p>
              <p className='text-2xl font-bold tracking-wider mb-4'>00:00</p>

              <div className='flex items-center justify-center gap-2 bg-muted/20 border border-border rounded-xl px-4 py-3 text-xs text-primary'>
                <svg
                  className='w-4 h-4 flex-shrink-0'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
                  />
                </svg>
                <span>시작 1분 전에 알림이 갑니다.</span>
              </div>
            </div>
          )}
        </div>
      </MobileLayout>
    </div>
  );
  */
  return <div>ImprisonmentPage</div>;
}
