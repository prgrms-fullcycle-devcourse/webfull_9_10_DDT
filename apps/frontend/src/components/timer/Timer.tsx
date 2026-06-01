'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { useSocket } from '@/contexts/SocketContext';
import { useRoom } from '@/contexts/RoomContext';
import { useAuthStore } from '@/store/useAuthStore';
import { useRoomStore } from '@/store/useRoomStore';
import { toast } from 'sonner';

type TimerMode = 'FOCUS' | 'BREAK';

interface TimerTick {
  timeLeft: number;
  mode: TimerMode;
  currentSession: number;
  totalSessions: number;
  focusDuration: number;
  breakDuration: number;
}

export default function Timer() {
  const router = useRouter();
  const socket = useSocket();
  const room = useRoom();
  const me = useAuthStore((s) => s.me);
  const phase = useRoomStore((s) => s.phase);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // 타이머 상태 (백엔드 timer:tick 수신)
  const [timer, setTimer] = useState<TimerTick>({
    timeLeft: 0,
    mode: 'FOCUS',
    currentSession: 1,
    totalSessions: 1,
    focusDuration: 0,
    breakDuration: 0,
  });

  // 백엔드 timer:tick 수신
  useEffect(() => {
    if (!socket) return;

    const handleTick = (data: TimerTick) => {
      setTimer(data);
    };

    socket.on('timer:tick', handleTick);

    return () => {
      socket.off('timer:tick', handleTick);
    };
  }, [socket]);

  // phase 변경 시 자동 이동
  useEffect(() => {
    if (!phase) return;
    if (phase === 'contract') {
      router.replace(`/room/${room.code}/contract`);
    } else if (phase === 'result') {
      router.replace(`/room/${room.code}/result-before`);
    }
  }, [phase, room.code, router]);

  const handleForfeit = () => {
    if (!socket) return;
    socket.emit('member:giveup');
    setIsModalOpen(false);
    toast.info('중도 포기 처리됩니다.');
  };

  if (!me) return null;

  const isFocus = timer.mode === 'FOCUS';
  const totalDuration = isFocus ? timer.focusDuration : timer.breakDuration;

  const theme = {
    textColor: isFocus ? 'text-primary' : 'text-success',
    strokeColor: isFocus ? 'stroke-primary' : 'stroke-success',
    statusText: isFocus ? '집중 시간' : '휴식 시간',
    subStatusText: isFocus ? '집중 중' : '휴식 중',
  };

  return (
    <MobileLayout
      header={
        <div className='w-full text-center'>
          <h1 className={`text-xl font-bold ${theme.textColor}`}>
            {theme.statusText} {timer.currentSession}/{timer.totalSessions}
          </h1>
        </div>
      }
      bottomButton={
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button
              type='button'
              className='w-full py-4 bg-transparent border border-border text-muted-foreground rounded-xl hover:bg-muted/30 transition-colors'
            >
              중도 포기
            </Button>
          </DialogTrigger>
          <DialogContent className='max-w-[320px] rounded-2xl border border-border bg-[#1E2538] p-6 text-white shadow-2xl focus:outline-none'>
            <DialogHeader className='text-left space-y-2'>
              <DialogTitle className='text-base font-bold leading-snug tracking-tight text-white'>
                포기하면 남은 시간이
                <br />
                모두 이탈 시간으로 처리돼요.
              </DialogTitle>
              <DialogDescription className='text-xs text-slate-400 font-medium leading-relaxed pt-0.5'>
                가장 많은 벌칙을 받게 됩니다.
              </DialogDescription>
            </DialogHeader>
            <div className='flex gap-2.5 mt-6 w-full'>
              <Button
                type='button'
                onClick={handleForfeit}
                className='flex-1 py-5 bg-[#F85A5A] hover:bg-[#E04F4F] text-white font-bold rounded-xl transition-colors border-none'
              >
                포기하기
              </Button>
              <Button
                type='button'
                onClick={() => setIsModalOpen(false)}
                className='flex-1 py-5 bg-[#2A314A] hover:bg-[#353D5C] text-white font-bold rounded-xl transition-colors border-none'
              >
                취소
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className='flex flex-col items-center justify-center w-full py-6'>
        <TimerProgressBar
          mode={timer.mode}
          currentSession={timer.currentSession}
          totalSessions={timer.totalSessions}
          timeLeft={timer.timeLeft}
          totalDuration={totalDuration}
          focusDuration={timer.focusDuration}
          breakDuration={timer.breakDuration}
        />

        <TimerCircle
          timeLeft={timer.timeLeft}
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
                className='w-4 h-4 shrink-0'
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
  );
}
