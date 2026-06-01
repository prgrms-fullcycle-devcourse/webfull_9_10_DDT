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
}

interface RoomStore {
  hostId: string | null;
  members: Record<string, RoomMember>;
  phase: string | null;

  setState: (data: {
    hostId: string;
    members: Record<string, RoomMember>;
    phase: string;
  }) => void;
  upsertMember: (userId: string, member: Partial<RoomMember>) => void;
  removeMember: (userId: string) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  hostId: null,
  members: {},
  phase: null,

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

  reset: () => set({ hostId: null, members: {}, phase: null }),
}));
