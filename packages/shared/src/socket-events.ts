// shared/src/socket-events.ts

import type { RoomMember, RoomState, Phase } from "./socket-data";

// ============================================
// 이벤트명 상수 (오타 방지)
// ============================================

export const SOCKET_EVENTS = {
  // 클라이언트 → 서버
  CLIENT_TO_SERVER: {
    PING: "ping",
    MEMBER_SIGN: "member:sign",
    MEMBER_KICK: "member:kick",
    CONTRACT_EDITED: "contract:edited",
    EDIT_MEMBER: "edit:member",
    EDIT_ALL: "edit:all",
  },
  // 서버 → 클라이언트
  SERVER_TO_CLIENT: {
    ROOM_STATE: "room:state",
    ROOM_CLOSED: "room:closed",
    MEMBER_JOINED: "member:joined",
    MEMBER_LEFT: "member:left",
    MEMBER_KICKED: "member:kicked",
    KICKED: "kicked",
    FORCE_DISCONNECT: "force-disconnect",
    SIGN_UPDATED: "sign:updated",
    SIGN_RESET: "sign:reset",
    EDIT_UPDATED: "edit:updated",
    EDIT_ALL_UPDATED: "edit:all-updated",
    BREAK_WARNING: "break:warning",
  },
} as const;

// ============================================
// 페이로드 타입 - 클라이언트 → 서버
// ============================================

export interface MemberSignPayload {
  signed: boolean;
}

export interface MemberKickPayload {
  targetId: string;
}

export interface EditMemberPayload {
  targetId: string;
  canEdit: boolean;
}

export interface EditAllPayload {
  canEdit: boolean;
}

// ContractEdited, Ping은 페이로드 없음

// ============================================
// 페이로드 타입 - 서버 → 클라이언트
// ============================================

export type RoomStatePayload = RoomState;

export interface RoomClosedPayload {
  reason: string;
}

export interface MemberJoinedPayload extends RoomMember {
  userId: string;
}

export interface MemberLeftPayload {
  userId: string;
}

export interface MemberKickedPayload {
  targetId: string;
}

export interface ForceDisconnectPayload {
  reason: string;
}

export interface SignUpdatedPayload {
  userId: string;
  signed: boolean;
}

export interface SignResetPayload {
  userId: string;
}

export interface EditUpdatedPayload {
  targetId: string;
  canEdit: boolean;
}

export interface EditAllUpdatedPayload {
  canEdit: boolean;
}

// ============================================
// 이벤트 ↔ 페이로드 매핑 (타입 안전 emit/on)
// ============================================

export interface ClientToServerEvents {
  ping: () => void;
  "member:sign": (payload: MemberSignPayload) => void;
  "member:kick": (payload: MemberKickPayload) => void;
  "contract:edited": () => void;
  "edit:member": (payload: EditMemberPayload) => void;
  "edit:all": (payload: EditAllPayload) => void;
}

export interface ServerToClientEvents {
  "room:state": (payload: RoomStatePayload) => void;
  "room:closed": (payload: RoomClosedPayload) => void;
  "member:joined": (payload: MemberJoinedPayload) => void;
  "member:left": (payload: MemberLeftPayload) => void;
  "member:kicked": (payload: MemberKickedPayload) => void;
  kicked: () => void;
  "force-disconnect": (payload: ForceDisconnectPayload) => void;
  "sign:updated": (payload: SignUpdatedPayload) => void;
  "sign:reset": (payload: SignResetPayload) => void;
  "edit:updated": (payload: EditUpdatedPayload) => void;
  "edit:all-updated": (payload: EditAllUpdatedPayload) => void;
  "break:warning": () => void;
}
