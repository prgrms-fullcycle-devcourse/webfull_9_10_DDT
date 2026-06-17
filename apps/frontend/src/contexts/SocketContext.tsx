'use client';

import { useRoomStore } from '@/store/useRoomStore';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { clearGuestAccessToken } from '@/lib/authToken';
import { queryKeys } from '@/lib/queryKeys';

const SocketContext = createContext<Socket | null>(null);

interface SocketProviderProps {
  roomCode: string;
  token: string;
  children: ReactNode;
}

/**
 * 방별 Socket.IO 연결을 생성하고 서버 이벤트를 받아 전역 방 스토어(useRoomStore)에 반영하는 Provider.
 * 멤버 입퇴장·서명·편집권한·세션 시작/종료·강퇴·방 종료 등 실시간 이벤트를 구독하며,
 * 강제 종료/강퇴/방 종료 시에는 토스트 안내 후 게스트 세션 정리 + 적절한 경로로 리다이렉트한다.
 *
 * @param roomCode - 연결할 방 코드 (소켓 query로 전달)
 * @param token - 인증 토큰 (소켓 auth로 전달)
 * @param children - 소켓을 사용할 하위 트리
 */
export function SocketProvider({
  roomCode,
  token,
  children,
}: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  // 방에서 튕겨날 때 게스트 토큰을 정리하고 me 캐시를 비운다. (회원 토큰은 건드리지 않음)
  const clearGuestSession = useCallback(() => {
    if (clearGuestAccessToken()) {
      queryClient.setQueryData(queryKeys.auth.me(), null);
    }
  }, [queryClient]);

  useEffect(() => {
    // 이미 연결된 소켓이 있으면 중복 생성하지 않는다. (StrictMode 이중 마운트·리렌더 대비)
    if (socketRef.current?.connected) {
      return;
    }

    const s = io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080', {
      auth: { token },
      query: { roomCode },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {
      console.log('연결 성공: ', s.id);
    });

    s.on('connect_error', (error) => {
      console.error('소켓 연결 실패: ', error.message);
    });

    s.on('disconnect', (reason) => {
      console.log('소켓 끊김: ', reason);
    });

    // 서버가 입장을 거부/강제 종료할 때. reason별로 안내 후 적절히 이동시킨다.
    s.on('force-disconnect', (data) => {
      if (data.reason === 'not-a-member') {
        toast.error('방에 참여하지 않았어요.');
        router.replace(`/room/${roomCode}`);
      } else if (data.reason === 'room-timer') {
        toast.error('이미 진행 중인 방이예요.');
        clearGuestSession();
        router.replace('/');
      } else if (data.reason === 'room-closed') {
        toast.error('이미 종료된 방이예요.');
        clearGuestSession();
        router.replace('/');
      } else if (data.reason === 'duplicate-connection') {
        // 같은 계정이 다른 곳에서 접속해 밀려난 경우. 자동 재연결을 끄지 않으면
        // 끊기자마자 다시 붙어 또 밀려나는 핑퐁이 생기므로 reconnection을 비활성화한다.
        toast.error('다른 환경에서의 로그인이 감지되었어요.');
        s.io.opts.reconnection = false;
        sessionStorage.setItem('duplicate-kicked', roomCode);
        clearGuestSession();
        router.replace('/');
      }
    });

    s.on('room:closed', ({ reason }: { reason?: string }) => {
      toast.error(reason ?? '방이 종료되었어요.');
      useRoomStore.getState().reset();
      clearGuestSession();
      router.replace('/');
    });

    s.on('room:state', (state) => {
      useRoomStore.getState().setState({
        hostId: state.hostId,
        members: state.members,
        phase: state.phase,
      });
    });

    s.on('member:joined', (member) => {
      useRoomStore.getState().upsertMember(member.userId, {
        ...member,
        connected: true,
      });
    });

    s.on('member:left', ({ userId }) => {
      useRoomStore.getState().removeMember(userId);
    });

    s.on('member:kicked', ({ targetId }) => {
      useRoomStore.getState().removeMember(targetId);
    });

    s.on('kicked', () => {
      toast.error('방장에 의해 강퇴되었어요.');
      clearGuestSession();
      router.replace('/');
    });

    s.on('sign:updated', ({ userId, signed }) => {
      if (userId) {
        useRoomStore.getState().upsertMember(userId, { isSigned: signed });
      }
    });

    s.on('sign:reset', () => {
      const members = useRoomStore.getState().members;
      Object.keys(members).forEach((id) => {
        useRoomStore.getState().upsertMember(id, { isSigned: false });
      });
    });

    s.on(
      'escape:summary',
      ({
        members,
      }: {
        members: { identifier: string; totalEscapeMs: number }[];
      }) => {
        useRoomStore.getState().setEscapeSummary(members);
      },
    );

    s.on('edit:updated', ({ targetId, canEdit }) => {
      useRoomStore.getState().upsertMember(targetId, { canEdit });
    });

    s.on('edit:all-updated', ({ canEdit }) => {
      const members = useRoomStore.getState().members;
      Object.keys(members).forEach((id) => {
        const isHost = members[id].isHost;
        if (!isHost) {
          useRoomStore.getState().upsertMember(id, { canEdit });
        }
      });
    });

    s.on(
      'session:started',
      (data: {
        startedAt: string;
        focusMin: number;
        breakMin: number;
        totalRounds: number;
        serverTime: string;
      }) => {
        // 클라이언트 시계가 서버와 어긋날 수 있으므로 그 차이(serverOffset)를 저장해두고,
        // 타이머 남은 시간을 서버 기준으로 보정 계산하게 한다.
        const clientNow = Date.now();
        const serverNow = new Date(data.serverTime).getTime();

        useRoomStore.getState().setState({ phase: 'timer' });
        useRoomStore.getState().setSessionInfo({
          startedAt: new Date(data.startedAt).getTime(),
          focusMin: data.focusMin,
          breakMin: data.breakMin,
          totalRounds: data.totalRounds,
          serverOffset: serverNow - clientNow,
        });
      },
    );

    s.on('session:ended', () => {
      useRoomStore.getState().setState({ phase: 'result' });
      useRoomStore.getState().setSessionInfo(null);
    });

    s.on('member:gave-up', ({ userId, gaveUpAt }) => {
      useRoomStore.getState().upsertMember(userId, { gaveUpAt });
    });

    s.on('break:warning', () => {
      toast.info('휴식이 1분 남았어요! ⏰', {
        description: '곧 집중 시간이 시작됩니다. 자리에 앉아주세요!',
        duration: 2000,
      });
    });

    socketRef.current = s;
    setSocket(s);

    // 언마운트(방 이탈) 시 리스너 제거·연결 종료·방 스토어 초기화로 다음 방에 상태가 새지 않게 한다.
    return () => {
      console.log('소켓 해제');
      s.removeAllListeners();
      s.disconnect();
      useRoomStore.getState().reset();
      socketRef.current = null;
    };
  }, [clearGuestSession, roomCode, router, token]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

/**
 * 현재 방의 Socket.IO 인스턴스를 반환한다. (연결 전이거나 Provider 밖이면 null)
 *
 * @returns 소켓 인스턴스 또는 null
 */
export function useSocket() {
  const socket = useContext(SocketContext);
  return socket;
}
