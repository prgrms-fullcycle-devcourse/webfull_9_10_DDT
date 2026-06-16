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
import { MobileLayout } from '@/components/layout/mobileLayout';
import { TimerProgressBar } from '@/components/ui/timerprogressbar';
import { TimerCircle } from '@/components/ui/timercircle';
import { urlBase64ToUint8Array } from '@/lib/utils';
import { useBlockBrowserBack } from '@/hooks/useBlockBrowserBack';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useAuth } from '@/hooks/useAuth';
import { getRoomApi } from '@/api/generated/room-api/room-api';
import { getToken } from '@/lib/getToken';
import { TimerHeader } from './TimerHeader';
import { WakeLockAlert } from './WakeLockAlert';
import { EscapeStatsCard } from './EscapeStatsCard';
import { ForfeitDialog } from './ForfeitDialog';

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
  const isFirstRunRef = useRef(true);

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

    // 마운트 직후 첫 실행 시에는 F5/초기 진입 시의 미세한 포커스 누락으로 인한 오경고를 막기 위해
    // document.hidden만 체크하고, 그 이후 시점부터는 포커스 유실(!hasFocus())까지 더해 엄격히 판단합니다.
    const isUserAway = isFirstRunRef.current
      ? document.hidden
      : (document.hidden || !document.hasFocus());
    
    isFirstRunRef.current = false;

    if (isUserAway) {
      if (isFocus && !isEscapingRef.current) {
        emitEscapeStart();
      } else if (!isFocus && isEscapingRef.current) {
        isEscapingRef.current = false;
        socket.emit('escape:end');
      }
    }
    isFocusRef.current = isFocus;
  }, [isFocus, socket, sessionInfo, emitEscapeStart]);

  useEffect(() => {
    if (!socket || !sessionInfo) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isFocusRef.current && !isEscapingRef.current) {
          emitEscapeStart();
        }
      } else {
        // 화면이 노출될 때, 실제 브라우저 포커스까지 갖고 있는 경우에만 이탈 상태를 해제합니다.
        // 화면만 켜지고 포커스는 다른 창에 남아 있다면 이탈 상태를 시작하거나 유지합니다.
        if (document.hasFocus()) {
          if (isEscapingRef.current) {
            isEscapingRef.current = false;
            socket.emit('escape:end');
          }
        } else {
          if (isFocusRef.current && !isEscapingRef.current) {
            emitEscapeStart();
          }
        }
        void syncEndedSessionRoute();
      }
    };
    const handleBlur = () => {
      if (isFocusRef.current && !isEscapingRef.current) {
        emitEscapeStart();
      }
    };

    const handleFocus = () => {
      if (isEscapingRef.current) {
        isEscapingRef.current = false;
        socket.emit('escape:end');
      }
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
    strokeColor: isFocus ? 'stroke-primary' : 'stroke-success',
    subStatusText: isFocus ? '집중 중' : '휴식 중',
  };

  return (
    <MobileLayout
      header={
        <TimerHeader
          isFocus={isFocus}
          round={round}
          totalRounds={totalRounds}
        />
      }
      bottomButton={
        <ForfeitDialog
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          onForfeit={handleForfeit}
          isPending={giveUpMutation.isPending}
        />
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

        <WakeLockAlert isSupported={isWakeLockSupported} />

        <EscapeStatsCard isFocus={isFocus} myEscapeMs={myEscapeMs} />
      </div>
    </MobileLayout>
  );
}
