export const SESSION_QUEUE = 'session';

export type SessionJob =
  | { kind: 'end'; roomCode: string }
  | { kind: 'break-warning'; roomCode: string; round: number };

export const endJobId = (roomCode: string) => `end_${roomCode}`;
export const warnJobId = (roomCode: string, round: number) =>
  `warn_${roomCode}_${round}`;
