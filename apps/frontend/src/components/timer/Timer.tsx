'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { getTimerApi } from '@/api/generated/timer-api-타이머-및-세션-제어/timer-api-타이머-및-세션-제어';
import { useRoom } from '@/contexts/RoomContext';
import { useSocket } from '@/contexts/SocketContext';
import { EscapeSummaryItem, useRoomStore } from '@/store/useRoomStore';
import { Button } from '@/components/ui/button';
import { MobileLayout } from '@/components/layout/mobileLayout';
import { HeaderTitle } from '@/components/layout/HeaderTitle';
import { TimerProgressBar } from '@/components/ui/timerprogressbar';
import { TimerCircle } from '@/components/ui/timercircle';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { urlBase64ToUint8Array } from '@/lib/utils';
import { useBlockBrowserBack } from '@/hooks/useBlockBrowserBack';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useAuth } from '@/hooks/useAuth';
import { formatDuration } from '@/lib/format';
import { getRoomApi } from '@/api/generated/room-api/room-api';
import { getToken } from '@/lib/getToken';

export default function Timer() {
  useBlockBrowserBack();

  const router = useRouter();
  const socket = useSocket();
  const room = useRoom();
  const me = useAuth().me;
  const phase = useRoomStore((s) => s.phase);
  const sessionInfo = useRoomStore((s) => s.sessionInfo);
  const myMember = useRoomStore((state) =>
    me ? state.members[me.id] : undefined,
  );

  const escapeSummary = useRoomStore((s) => s.escapeSummary);
  const setEscapeSummary = useRoomStore((s) => s.setEscapeSummary);
  const myEscapeMs =
    escapeSummary.find((m: EscapeSummaryItem) => m.identifier === me?.id)
      ?.totalEscapeMs ?? 0;

  const { isSupported: isWakeLockSupported } = useWakeLock();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const isFocusRef = useRef(true);
  const isCheckingRoomPhaseRef = useRef(false);

  const isEscapingRef = useRef(false);

  useEffect(() => {
    if (myMember?.gaveUpAt) {
      toast.error('이미 탈옥한 방이예요.');
      router.replace(`/room/${room.code}/roulette?from=giveup`);
    }
  }, [myMember?.gaveUpAt, room.code, router]);

  useEffect(() => {
    if (!sessionInfo) return;
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [sessionInfo]);

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
    }, 5000);
    return () => window.clearInterval(interval);
  }, [socket, sessionInfo]);

  useEffect(() => {
    void getRoomApi()
      .roomControllerGetEscapeSummary(room.code)
      .then((res) =>
        setEscapeSummary(res.data as unknown as EscapeSummaryItem[]),
      );
  }, [room.code, setEscapeSummary]);

  useEffect(() => {
    async function subscribeToPush() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      try {
        if (Notification.permission !== 'granted') return;

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
          {
            subscription: subscription,
            platform: 'web',
          },
          {
            headers: {
              Authorization: `Bearer ${getToken() ?? ''}`,
            },
          },
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
      toast.info('탈옥했어요.');
      setIsModalOpen(false);

      router.push(`/room/${room.code}/roulette?from=giveup`);
    },
    onError: (error) => {
      const message = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message
        : undefined;
      toast.error(message ?? '탈옥에 실패했어요.');
    },
  });

  const handleForfeit = () => {
    giveUpMutation.mutate();
  };

  const adjustedNow = now + (sessionInfo?.serverOffset ?? 0);
  const elapsed = adjustedNow - (sessionInfo?.startedAt ?? adjustedNow);
  const focusMs = (sessionInfo?.focusMin ?? 0) * 60 * 1000;
  const breakMs = (sessionInfo?.breakMin ?? 0) * 60 * 1000;
  const cycleMs = focusMs + breakMs;
  const totalRounds = sessionInfo?.totalRounds ?? 1;
  const totalMs =
    focusMs * totalRounds + breakMs * Math.max(0, totalRounds - 1);

  const clampedElapsed = Math.min(Math.max(0, elapsed), totalMs);
  const lastRoundStartMs = cycleMs * Math.max(0, totalRounds - 1);
  const isLastRound = cycleMs > 0 ? clampedElapsed >= lastRoundStartMs : true;

  const round = isLastRound
    ? totalRounds
    : Math.floor(clampedElapsed / cycleMs) + 1;
  const cycleElapsed = isLastRound
    ? clampedElapsed - lastRoundStartMs
    : clampedElapsed % cycleMs;
  const isFocus = isLastRound || cycleElapsed < focusMs;

  const phaseRemainingMs = isFocus
    ? focusMs - cycleElapsed
    : cycleMs - cycleElapsed;
  const phaseTotalMs = isFocus ? focusMs : breakMs;

  const phaseRemainingSec = Math.max(0, Math.ceil(phaseRemainingMs / 1000));
  const phaseTotalSec = Math.ceil(phaseTotalMs / 1000);
  const focusDurationSec = (sessionInfo?.focusMin ?? 0) * 60;
  const breakDurationSec = (sessionInfo?.breakMin ?? 0) * 60;

  const lastEscapeStartRef = useRef<number>(0);

  const emitEscapeStart = useCallback(() => {
    const now = Date.now();
    if (now - lastEscapeStartRef.current < 300) return;

    lastEscapeStartRef.current = now;
    isEscapingRef.current = true;
    socket?.emit('escape:start');

    toast.error('방을 이탈했어요! 이탈 시간이 누적돼요.', {
      duration: 3000,
    });
  }, [socket]);

  const syncEndedSessionRoute = useCallback(async () => {
    if (!sessionInfo || isCheckingRoomPhaseRef.current) return;

    isCheckingRoomPhaseRef.current = true;
    try {
      const res = await getRoomApi().roomControllerFindById(room.code);
      const data = res.data as { phase?: string };

      if (data.phase === 'result') {
        router.replace(`/room/${room.code}/semi-result`);
      } else if (data.phase === 'closed') {
        sessionStorage.setItem('totalResultFrom', 'room');
        router.replace(`/room/${room.code}/total-result`);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        sessionStorage.setItem('totalResultFrom', 'room');
        router.replace(`/room/${room.code}/total-result`);
      }
    } finally {
      isCheckingRoomPhaseRef.current = false;
    }
  }, [room.code, router, sessionInfo]);

  const isExpiredPhase = phaseRemainingSec <= 0;

  useEffect(() => {
    if (!isExpiredPhase) return;

    void syncEndedSessionRoute();

    const intervalId = setInterval(() => {
      void syncEndedSessionRoute();
    }, 2000);

    return () => clearInterval(intervalId);
  }, [isExpiredPhase, syncEndedSessionRoute]);

  useEffect(() => {
    if (!socket || !sessionInfo) return;

    if (document.hidden) {
      if (isFocus && !isEscapingRef.current) {
        emitEscapeStart();
      } else {
        socket.emit('escape:end');
      }
    }
    isFocusRef.current = isFocus;
  }, [isFocus, socket, sessionInfo, emitEscapeStart]);

  useEffect(() => {
    if (!socket || !sessionInfo) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isFocusRef.current) {
          emitEscapeStart();
        }
      } else {
        isEscapingRef.current = false;
        socket.emit('escape:end');
        void syncEndedSessionRoute();
      }
    };
    const handleBlur = () => {
      if (isFocusRef.current) {
        emitEscapeStart();
      }
    };

    const handleFocus = () => {
      socket.emit('escape:end');
      void syncEndedSessionRoute();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [socket, sessionInfo, syncEndedSessionRoute, emitEscapeStart]);

  if (!me) return null;
  if (!sessionInfo)
    return (
      <div className='flex items-center justify-center w-full h-screen text-white'>
        수감 준비 중...
      </div>
    );

  const theme = {
    textColor: isFocus ? '' : 'text-success',
    strokeColor: isFocus ? 'stroke-primary' : 'stroke-success',
    statusText: isFocus ? '집중 시간' : '휴식 시간',
    subStatusText: isFocus ? '집중 중' : '휴식 중',
  };

  return (
    <MobileLayout
      header={
        <HeaderTitle align='center' className={theme.textColor}>
          {theme.statusText} {round} /{' '}
          {isFocus ? totalRounds : Math.max(0, totalRounds - 1)}
        </HeaderTitle>
      }
      bottomButton={
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button
              type='button'
              className='w-full h-12 rounded-[14px] text-base font-bold bg-transparent border border-border text-muted-foreground hover:bg-muted/30 transition-colors'
            >
              탈옥
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>탈옥하시겠어요?</DialogTitle>
              <DialogDescription>
                탈옥하면 남은 시간이
                <br />
                모두 이탈 시간으로 처리돼요.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type='button'
                onClick={handleForfeit}
                disabled={giveUpMutation.isPending}
                className='flex-1 h-12 rounded-lg bg-destructive hover:bg-destructive/80 text-white font-bold border-none'
              >
                {giveUpMutation.isPending ? '탈옥 하는 중...' : '탈옥하기'}
              </Button>
              <Button
                type='button'
                variant='secondary'
                onClick={() => setIsModalOpen(false)}
                className='flex-1 h-12 rounded-lg'
              >
                취소
              </Button>
            </DialogFooter>
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

        {!isWakeLockSupported && (
          <div className='text-center mt-4 w-full max-w-sm px-4'>
            <div className='flex items-start justify-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-xs text-destructive'>
              <span>
                현재 기기에서 화면 꺼짐 방지가 지원되지 않아요.
                <br />
                원활한 집중을 위해 기기의 <b>자동 화면 꺼짐 시간</b>을
                늘려주세요.
              </span>
            </div>
          </div>
        )}

        {!isFocus && (
          <div className='flex justify-center flex-col gap-2 text-center mt-10 w-full max-w-sm text-destructive'>
            <div className='flex flex-col items-center justify-center bg-muted/20  rounded-[14px] px-4 py-3'>
              <p className='text-xs mb-1'>총 이탈 시간</p>
              <p className='text-2xl font-bold tracking-wider '>
                {myEscapeMs > 0 ? formatDuration(myEscapeMs) : '0초'}
              </p>
            </div>

            <div className='flex items-center justify-center gap-2 bg-muted/20  rounded-[14px] px-4 py-3 text-xs text-[#FACC15]'>
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
              <span>시작 1분 전에 알림이 울려요.</span>
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
