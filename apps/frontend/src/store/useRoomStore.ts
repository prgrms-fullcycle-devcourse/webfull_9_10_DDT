import { create } from 'zustand';

/** 방에 참여 중인 멤버 한 명의 상태. (소켓 이벤트로 실시간 갱신) */
export interface RoomMember {
  userId: string;
  nickname: string;
  profileImage: string;
  isHost: boolean;
  isLoggedIn: boolean;
  /** 현재 소켓 연결 여부 */
  connected: boolean;
  socketId?: string;
  /** 계약서 서명 완료 여부 */
  isSigned?: boolean;
  /** 방장이 부여한 계약서 편집 권한 */
  canEdit?: boolean;
  /** 중도 포기 시각(ISO). null/undefined면 진행 중 */
  gaveUpAt?: string | null;
}

/** 멤버별 총 이탈 시간 요약 (결과 화면용). */
export interface EscapeSummaryItem {
  identifier: string;
  totalEscapeMs: number;
}

/** 진행 중인 집중 세션 정보. */
interface SessionInfo {
  startedAt: number;
  focusMin: number;
  breakMin: number;
  totalRounds: number;
  /** 서버-클라이언트 시각 차이(ms). 남은 시간 계산을 서버 기준으로 보정하는 데 쓴다. */
  serverOffset: number;
}

interface RoomStore {
  hostId: string | null;
  members: Record<string, RoomMember>;
  phase: string | null;
  sessionInfo: SessionInfo | null;
  escapeSummary: EscapeSummaryItem[];

  setState: (
    data: Partial<{
      hostId: string;
      members: Record<string, RoomMember>;
      phase: string;
    }>,
  ) => void;
  upsertMember: (userId: string, member: Partial<RoomMember>) => void;
  removeMember: (userId: string) => void;
  reset: () => void;
  setSessionInfo: (info: SessionInfo | null) => void;
  setEscapeSummary: (summary: EscapeSummaryItem[]) => void;
}

/**
 * 방 실시간 상태(방장·멤버·단계·세션·이탈 요약)를 담는 전역 Zustand 스토어.
 * SocketContext가 소켓 이벤트를 받아 이 스토어를 갱신하고, 계약서/타이머 화면이 구독한다.
 */
export const useRoomStore = create<RoomStore>((set) => ({
  hostId: null,
  members: {},
  phase: null,
  sessionInfo: null,
  escapeSummary: [],

  setState: (data) => set(data),

  // 멤버를 추가하거나, 이미 있으면 전달된 필드만 부분 병합한다. (서명·연결 등 부분 업데이트 이벤트용)
  upsertMember: (userId, member) =>
    set((s) => ({
      members: {
        ...s.members,
        [userId]: { ...s.members[userId], ...member } as RoomMember,
      },
    })),

  removeMember: (userId) =>
    set((s) => {
      const next = { ...s.members };
      delete next[userId];
      return { members: next };
    }),

  reset: () =>
    set({
      hostId: null,
      members: {},
      phase: null,
      sessionInfo: null,
      escapeSummary: [],
    }),

  setSessionInfo: (info) => set({ sessionInfo: info }),
  setEscapeSummary: (summary) => set({ escapeSummary: summary }),
}));
