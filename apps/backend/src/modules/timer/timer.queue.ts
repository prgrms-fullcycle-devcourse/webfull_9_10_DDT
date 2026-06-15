export const SESSION_QUEUE = 'session';

export type SessionJob =
  | { kind: 'end'; roomCode: string }
  | { kind: 'break-warning'; roomCode: string; round: number }
  | { kind: 'break-start'; roomCode: string; round: number }
  | { kind: 'reveal-penalties'; roomCode: string; memberId: string };

export const endJobId = (roomCode: string) => `end_${roomCode}`;
export const warnJobId = (roomCode: string, round: number) =>
  `warn_${roomCode}_${round}`;
export const breakStartJobId = (roomCode: string, round: number) =>
  `break_start_${roomCode}_${round}`;

export const revealJobId = (roomCode: string, memberId: string) =>
  `reveal_${roomCode}_${memberId}`;
