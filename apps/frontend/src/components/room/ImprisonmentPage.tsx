'use client';

import { useState, useEffect } from 'react';
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

type TimerMode = 'FOCUS' | 'BREAK';

const API_DATA = { //api로 교체
  focusDuration: 5,
  breakDuration: 3,
  totalSessions: 4,
};

export default function ImprisonmentPage() {
  const [mode, setMode] = useState<TimerMode>('FOCUS');
  const [currentSession, setCurrentSession] = useState<number>(1);
  const [timeLeft, setTimeLeft] = useState<number>(API_DATA.focusDuration);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const totalSessions = API_DATA.totalSessions;

  const getDuration = (targetMode: TimerMode) => {
    return targetMode === 'FOCUS'
      ? API_DATA.focusDuration
      : API_DATA.breakDuration;
  };

  const totalDuration = getDuration(mode);
  const isFocus = mode === 'FOCUS';

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      if (timeLeft === 0) {
        if (mode === 'FOCUS') {
          if (currentSession === totalSessions) {
            setIsActive(false);
            console.log('끝'); //결과 페이지로 이동
            return;
          }

          console.log('휴식 시작'); //휴식 시작 알람
          setMode('BREAK');
          setTimeLeft(API_DATA.breakDuration);
        } else {
          if (currentSession < totalSessions) {
            console.log(`집중 시작`); //집중 시작 알람
            
            setCurrentSession((prev) => prev + 1);
            setMode('FOCUS');
            setTimeLeft(API_DATA.focusDuration);
          }
        }
        return;
      }

      setTimeLeft((prev) => {
        const nextTime = prev - 1;

        if (mode === 'BREAK' && nextTime === 60) {
          console.log('집중 시작 1분 전'); //집중 1분전 알람
        }

        return nextTime;
      });

    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, mode, currentSession, totalSessions, isActive]);

  const handleForfeit = () => {
    setIsActive(false);
    setIsModalOpen(false);
    console.log('중도 포기'); //중도 포기
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
}