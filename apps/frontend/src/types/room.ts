// src/types/room.ts (새 파일)
export interface RoomCreateResponse {
  code: string;
  url: string;
}

export interface RoomFindResponse {
  title: string;
  id: string;
  memberCount: number;
  phase: string;
}

export interface RoomJoinResponse {
  id: string;
  isReturning: boolean;
}
