export type Phase = "lobby" | "contract" | "timer" | "result" | "closed";

export interface RoomMember {
  nickname: string;
  profileImage: string;
  isHost: boolean;
  isLoggedIn: boolean;
  connected: boolean;
  socketId?: string;
  isSigned: boolean;
  canEdit: boolean;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  phase: Phase;
  members: Record<string, RoomMember>;
}
