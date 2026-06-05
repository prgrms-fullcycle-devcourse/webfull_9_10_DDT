'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { getTimerApi } from '@/api/generated/timer-api-타이머-및-세션-제어/timer-api-타이머-및-세션-제어';
import { useRoom } from '@/contexts/RoomContext';
import { useSocket } from '@/contexts/SocketContext';
import { useAuthStore } from '@/store/useAuthStore';
import { useRoomStore } from '@/store/useRoomStore';
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
import { urlBase64ToUint8Array } from '@/lib/utils';
import { useWakeLock } from '@/hooks/useWakeLock';

export default function Timer() {
  const router = useRouter();
  const socket = useSocket();
  const room = useRoom();
  const me = useAuthStore((s) => s.me);
  const phase = useRoomStore((s) => s.phase);
  const sessionInfo = useRoomStore((s) => s.sessionInfo);

  // 화면 꺼짐 방지 실행
  const { isSupported: isWakeLockSupported } = useWakeLock();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  
  // 이벤트 리스너 안에서 최신 isFocus 상태를 알기 위한 Ref
  const isFocusRef = useRef(true);

  useEffect(() => {
    if (!sessionInfo) return;
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [sessionInfo]);

  // 서버(소켓)에서 전달받은 phase에 의해서만 페이지를 이동시킵니다 (레이스 컨디션 해결)
  useEffect(() => {
    if (!phase) return;
    if (phase === 'contract') {
      router.replace(`/room/${room.code}/contract`);
    } else if (phase === 'result') {
      router.replace(`/room/${room.code}/semi-result`);
    }
  }, [phase, room.code, router]);

  useEffect(() => {
    if (!socket || !sessionInfo) return;
    const interval = window.setInterval(() => {
      socket.emit('heartbeat');
    }, 10000);
    return () => window.clearInterval(interval);
  }, [socket, sessionInfo]);

  useEffect(() => {
    async function subscribeToPush() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return; 

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
          const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!publicVapidKey) return;
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
          });
        }

        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/rooms/${room.code}/push-subscription`,
          subscription,
          { headers: { Authorization: `Bearer ${document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/)?.[1]}` } }
        );
      } catch (error) {
        console.error('푸시 알림 설정 실패:', error);
      }
    }
    subscribeToPush();
  }, [room.code]);

  const giveUpMutation = useMutation({
    mutationFn: async () => {
      const res = await getTimerApi().timerControllerGiveUp(room.code);
      return res.data;
    },
    onSuccess: () => {
      toast.info('중도 포기 처리되었습니다.');
      setIsModalOpen(false);
      router.push('/');
    },
    onError: (error) => {
      const message = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message
        : undefined;
      toast.error(message ?? '중도 포기 처리에 실패했습니다.');
    },
  });

  const handleForfeit = () => {
    giveUpMutation.mutate();
  };

  if (!me) return null;
  if (!sessionInfo) return <div>로딩 중...</div>;

  // 시간 및 상태 계산
  const adjustedNow = now + sessionInfo.serverOffset;
  const elapsed = adjustedNow - sessionInfo.startedAt;
  const cycleMs = (sessionInfo.focusMin + sessionInfo.breakMin) * 60 * 1000;
  const focusMs = sessionInfo.focusMin * 60 * 1000;
  const breakMs = sessionInfo.breakMin * 60 * 1000;
  const totalRounds = sessionInfo.totalRounds;
  const totalMs = focusMs * totalRounds + breakMs * Math.max(0, totalRounds - 1);
  
  const clampedElapsed = Math.min(Math.max(0, elapsed), totalMs);
  const lastRoundStartMs = cycleMs * Math.max(0, totalRounds - 1);
  const isLastRound = clampedElapsed >= lastRoundStartMs;

  const round = isLastRound ? totalRounds : Math.floor(clampedElapsed / cycleMs) + 1;
  const cycleElapsed = isLastRound ? clampedElapsed - lastRoundStartMs : clampedElapsed % cycleMs;
  const isFocus = isLastRound || cycleElapsed < focusMs;
  
  const phaseRemainingMs = isFocus ? focusMs - cycleElapsed : cycleMs - cycleElapsed;
  const phaseTotalMs = isFocus ? focusMs : breakMs;

  const phaseRemainingSec = Math.max(0, Math.ceil(phaseRemainingMs / 1000));
  const phaseTotalSec = Math.ceil(phaseTotalMs / 1000);
  const focusDurationSec = sessionInfo.focusMin * 60;
  const breakDurationSec = sessionInfo.breakMin * 60;

  // 1. isFocus 상태 업데이트 및 타이머 전환 시 자동 이탈/복귀 처리 (화면 꺼진 상태 대비)
  useEffect(() => {
    if (!socket || !sessionInfo) return;

    if (document.hidden) {
      if (isFocus) {
        // 휴식 -> 집중으로 넘어갔는데 아직 안 돌아왔다면: 이탈 시작
        socket.emit('escape:start');
      } else {
        // 집중 -> 휴식으로 넘어갔는데 아직 안 돌아왔다면: 억울한 벌칙 방지를 위해 이탈 종료
        socket.emit('escape:end');
      }
    }
    // 최신 상태 동기화
    isFocusRef.current = isFocus;
  }, [isFocus, socket, sessionInfo]);

  // 2. 화면 이탈 / 복귀 감지
  useEffect(() => {
    if (!socket || !sessionInfo) return;

    const handler = () => {
      if (document.hidden) {
        // 화면을 나갈 때: 현재 '집중 시간'일 때만 이탈로 간주
        if (isFocusRef.current) {
          socket.emit('escape:start');
          toast.error('화면을 이탈했습니다! 벌칙 시간이 누적됩니다.', { duration: 3000 });
        }
      } else {
        // 화면으로 돌아올 때: 모드에 상관없이 안전하게 닫기 신호 전송
        socket.emit('escape:end');
      }
    };

    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [socket, sessionInfo]);

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
            {theme.statusText} {round} / {totalRounds}
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
                disabled={giveUpMutation.isPending}
                className='flex-1 py-5 bg-[#F85A5A] hover:bg-[#E04F4F] text-white font-bold rounded-xl transition-colors border-none'
              >
                {giveUpMutation.isPending ? '처리 중...' : '포기하기'}
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
          totalSessions={totalRounds}
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

        {/* 미지원 기기용 안내 문구 (WakeLock 실패 시 렌더링) */}
        {!isWakeLockSupported && (
          <div className='text-center mt-4 w-full max-w-sm px-4'>
            <div className='flex items-start justify-center gap-2 bg-[#F85A5A]/10 border border-[#F85A5A]/30 rounded-xl px-4 py-3 text-xs text-[#F85A5A]'>
              <span>
                현재 기기에서 화면 꺼짐 방지가 지원되지 않습니다.<br />
                원활한 집중을 위해 기기의 <b>자동 화면 꺼짐 시간</b>을 늘려주세요.
              </span>
            </div>
          </div>
        )}

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