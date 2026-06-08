import { create } from 'zustand';

export interface RoomMember {
  userId: string;
  nickname: string;
  profileImage: string;
  isHost: boolean;
  isLoggedIn: boolean;
  connected: boolean;
  socketId?: string;
  isSigned?: boolean;
  canEdit?: boolean;
  gaveUpAt?: string | null;
}

export interface EscapeSummaryItem {
  identifier: string;
  totalEscapeMs: number;
}

interface SessionInfo {
  startedAt: number;
  focusMin: number;
  breakMin: number;
  totalRounds: number;
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

export const useRoomStore = create<RoomStore>((set) => ({
  hostId: null,
  members: {},
  phase: null,
  sessionInfo: null,
  escapeSummary: [],

  setState: (data) => set(data),

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
