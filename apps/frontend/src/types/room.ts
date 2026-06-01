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
