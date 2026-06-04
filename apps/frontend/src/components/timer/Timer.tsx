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
import { useMutation } from '@tanstack/react-query';
import { getTimerApi } from '@/api/generated/timer-api-타이머-및-세션-제어/timer-api-타이머-및-세션-제어';
import axios from 'axios';

export default function Timer() {
  const router = useRouter();
  const socket = useSocket();
  const room = useRoom();
  const me = useAuthStore((s) => s.me);
  const phase = useRoomStore((s) => s.phase);
  const sessionInfo = useRoomStore((s) => s.sessionInfo);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!sessionInfo) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionInfo]);

  useEffect(() => {
    if (!phase) return;
    if (phase === 'contract') {
      router.replace(`/room/${room.code}/contract`);
    } else if (phase === 'result') {
      router.replace(`/room/${room.code}/result-before`);
    }
  }, [phase, room.code, router]);

  useEffect(() => {
    if (!socket || !sessionInfo) {
      return;
    }

    const interval = setInterval(() => {
      socket.emit('heartbeat');
    }, 5000);
    return () => clearInterval(interval);
  }, [socket, sessionInfo]);

  useEffect(() => {
    if (!socket || !sessionInfo) {
      return;
    }
    const handler = () => {
      if (document.hidden) {
        socket.emit('escape:start');
      } else {
        socket.emit('escape:end');
      }
    };

    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [socket, sessionInfo]);

  const giveUpMutation = useMutation({
    mutationFn: async () => {
      const res = await getTimerApi().timerControllerGiveUp(room.code);
      return res.data;
    },
    onSuccess: () => {
      toast.info('중도 포기 처리됬습니다.');
    },
    onError: (error) => {
      const message = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message
        : undefined;
      toast.error(message);
    },
  });

  const handleForfeit = () => {
    giveUpMutation.mutate();
    setIsModalOpen(false);
  };

  if (!me) return null;
  if (!sessionInfo) return <div>로딩 중...</div>;

  const adjustedNow = now + sessionInfo.serverOffset;
  const elapsed = adjustedNow - sessionInfo.startedAt;
  const cycleMs = (sessionInfo.focusMin + sessionInfo.breakMin) * 60 * 1000;
  const focusMs = sessionInfo.focusMin * 60 * 1000;
  const breakMs = sessionInfo.breakMin * 60 * 1000;

  const round = Math.floor(elapsed / cycleMs) + 1;
  const cycleElapsed = elapsed % cycleMs;
  const isFocus = cycleElapsed < focusMs;
  const phaseRemainingMs = isFocus
    ? focusMs - cycleElapsed
    : cycleMs - cycleElapsed;
  const phaseTotalMs = isFocus ? focusMs : breakMs;

  // 초 단위 변환 (컴포넌트가 초 기대)
  const phaseRemainingSec = Math.ceil(phaseRemainingMs / 1000);
  const phaseTotalSec = Math.ceil(phaseTotalMs / 1000);
  const focusDurationSec = sessionInfo.focusMin * 60;
  const breakDurationSec = sessionInfo.breakMin * 60;

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
            {theme.statusText} {round} / {sessionInfo.totalRounds}
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
          mode={isFocus ? 'FOCUS' : 'BREAK'}
          currentSession={round}
          totalSessions={sessionInfo.totalRounds}
          timeLeft={phaseRemainingSec}
          totalDuration={phaseTotalSec}
          focusDuration={focusDurationSec}
          breakDuration={breakDurationSec}
        />

        <TimerCircle
          timeLeft={phaseRemainingSec}
          totalDuration={phaseTotalSec}
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
