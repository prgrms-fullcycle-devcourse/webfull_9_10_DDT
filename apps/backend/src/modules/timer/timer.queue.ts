/** BullMQ 세션 큐 이름 */
export const SESSION_QUEUE = 'session';

/**
 * 세션 큐에서 처리하는 잡 타입 유니온.
 * - end: 세션 종료
 * - break-warning: 휴식 종료 1분 전 알림
 * - break-start: 휴식 시작 시점 이탈 통계 전송
 * - reveal-penalties: 룰렛 미완료 시 벌칙 자동 공개 (10분 타임아웃)
 */
export type SessionJob =
  | { kind: 'end'; roomCode: string }
  | { kind: 'break-warning'; roomCode: string; round: number }
  | { kind: 'break-start'; roomCode: string; round: number }
  | { kind: 'reveal-penalties'; roomCode: string; memberId: string };

/** 세션 종료 잡 ID 생성 */
export const endJobId = (roomCode: string) => `end_${roomCode}`;

/** 세션 종료 잡 ID 생성 */
export const warnJobId = (roomCode: string, round: number) =>
  `warn_${roomCode}_${round}`;

/** 휴식 시작 잡 ID 생성 */
export const breakStartJobId = (roomCode: string, round: number) =>
  `break_start_${roomCode}_${round}`;

/** 벌칙 자동 공개 잡 ID 생성 */
export const revealJobId = (roomCode: string, memberId: string) =>
  `reveal_${roomCode}_${memberId}`;
