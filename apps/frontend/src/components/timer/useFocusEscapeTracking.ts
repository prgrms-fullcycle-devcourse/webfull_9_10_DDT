import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { Socket } from 'socket.io-client';

interface UseFocusEscapeTrackingProps {
  socket: Socket | null;
  sessionInfo: unknown;
  isFocus: boolean;
  onFocusReturn: () => void;
}

export function useFocusEscapeTracking({
  socket,
  sessionInfo,
  isFocus,
  onFocusReturn,
}: UseFocusEscapeTrackingProps) {
  const isFocusRef = useRef(true);
  const isEscapingRef = useRef(false);
  const isFirstRunRef = useRef(true);
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
        void onFocusReturn();
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
      void onFocusReturn();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [socket, sessionInfo, onFocusReturn, emitEscapeStart]);
}
