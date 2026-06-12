import { PenaltyService } from './penalty.service';
import type { PrismaService } from '../../common/prisma.service';

// 기본 티어 매트릭스 (domain-rules §1) — 최고 등급 count=2
const DEFAULT_TIERS = [
  { tier: 1, minPct: 0, maxPct: 10, count: 0 },
  { tier: 2, minPct: 10, maxPct: 30, count: 1 },
  { tier: 3, minPct: 30, maxPct: null, count: 2 },
];

const ROOM_CODE = 'TESTCODE';
const MEMBER_ID = 'm1';
// 세션 시작 기준 시각. 계획 종료 = 시작 + (25*4 + 5*3)분 = 115분(마지막 라운드 뒤 break 없음).
const T0 = new Date('2026-06-01T00:00:00.000Z').getTime();
const GAVE_UP_AT = T0 + 10 * 60 * 1000; // 포기: 시작 10분 후

// 산정은 '집중 시간(휴식 제외)'만 합산(getEffectiveFocusEscapeMs).
// focus창: R0[0~25] R1[30~55] R2[60~85] R3[90~115]분.
// give-up 잔여(10분~끝, 집중만) = 15 + 25*3 = 90분
const GIVEUP_RESIDUAL_MS = 90 * 60 * 1000; // 5,400,000

const POOL = [
  { id: 'p1', content: '팔굽혀펴기', templateId: 't1' },
  { id: 'p2', content: '노래 부르기', templateId: 't1' },
];

type TxMock = {
  escapeLog: { update: jest.Mock };
  roomResult: { findUnique: jest.Mock; create: jest.Mock };
  resultPenalty: { createMany: jest.Mock };
};

describe('PenaltyService.calculateAndSaveForGiveUp', () => {
  let service: PenaltyService;
  let roomFindUnique: jest.Mock;
  let tx: TxMock;

  function buildRoom(member: unknown) {
    return {
      code: ROOM_CODE,
      startedAt: new Date(T0),
      endedAt: null,
      template: {
        focusMin: 25,
        breakMin: 5,
        rounds: 4,
        tierConfig: { tiers: DEFAULT_TIERS },
        penalties: POOL,
      },
      roomMembers: [member],
    };
  }

  beforeEach(() => {
    roomFindUnique = jest.fn();
    tx = {
      escapeLog: { update: jest.fn() },
      roomResult: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      resultPenalty: { createMany: jest.fn() },
    };
    const prismaMock = {
      room: { findUnique: roomFindUnique },
      $transaction: jest.fn((cb: (t: TxMock) => unknown) => cb(tx)),
    };
    service = new PenaltyService(prismaMock as unknown as PrismaService);
  });

  it('등급은 이탈시간 기반(91%→최고등급)·벌칙 개수는 최대로 즉시 전체공개한다', async () => {
    roomFindUnique.mockResolvedValue(
      buildRoom({
        id: MEMBER_ID,
        gaveUpAt: new Date(GAVE_UP_AT),
        // 이미 복귀 마감된 로그 1건 (durationMs 60초)
        escapeLogs: [
          {
            id: 'l1',
            escapedAt: new Date(T0),
            returnedAt: new Date(T0 + 60000),
            durationMs: 60000,
          },
        ],
      }),
    );

    await service.calculateAndSaveForGiveUp(ROOM_CODE, MEMBER_ID);

    // 닫힌 로그 [T0, T0+60초]는 R0 집중구간 내 → effectiveMs=60,000.
    // totalEscapeMs = 60,000 + give-up 잔여(집중만)
    expect(tx.roomResult.create).toHaveBeenCalledWith({
      data: {
        roomMemberId: MEMBER_ID,
        roomCode: ROOM_CODE,
        totalEscapeMs: 60000 + GIVEUP_RESIDUAL_MS,
        penaltyTier: 3,
      },
    });

    // 최대 개수 count=2 → 합계 2개, 전부 공개.
    // 복원추출(독립 추첨)이라 같은 벌칙이 중복될 수 있어 '종류 수'는 단정하지 않고,
    // 합계와 풀 소속만 검증한다.
    const createManyCalls = tx.resultPenalty.createMany.mock.calls as Array<
      [{ data: { content: string; count: number; isRevealed: boolean }[] }]
    >;
    const createManyArg = createManyCalls[0][0];
    const poolContents = POOL.map((p) => p.content);
    const totalCount = createManyArg.data.reduce((a, d) => a + d.count, 0);
    expect(totalCount).toBe(2);
    expect(createManyArg.data.every((d) => d.isRevealed === true)).toBe(true);
    expect(
      createManyArg.data.every((d) => poolContents.includes(d.content)),
    ).toBe(true);
  });

  it('늦은 포기: 등급 배지는 이탈시간 기반(낮음)이나 벌칙 개수는 항상 최대다', async () => {
    // 95분에 포기 → 잔여 [95,115]∩focus = R3 20분만. 이전 로그 없음.
    const lateGaveUp = T0 + 95 * 60 * 1000;
    roomFindUnique.mockResolvedValue(
      buildRoom({
        id: MEMBER_ID,
        gaveUpAt: new Date(lateGaveUp),
        escapeLogs: [],
      }),
    );

    await service.calculateAndSaveForGiveUp(ROOM_CODE, MEMBER_ID);

    // 잔여 20분 / 총 집중 100분 = 20% → tier 2 (10~30%). 최고등급(t3) 아님.
    const residualMs = 20 * 60 * 1000; // 1,200,000
    expect(tx.roomResult.create).toHaveBeenCalledWith({
      data: {
        roomMemberId: MEMBER_ID,
        roomCode: ROOM_CODE,
        totalEscapeMs: residualMs,
        penaltyTier: 2, // 시간 기반: 최고등급 아님
      },
    });

    // 그러나 벌칙 개수는 항상 최대(최고등급 count=2) + 즉시 전체공개.
    // tier2의 정상 count(1)가 아니라 최대치(2)임을 검증 → 등급/개수 분리.
    const createManyArg = (
      tx.resultPenalty.createMany.mock.calls as Array<
        [{ data: { count: number; isRevealed: boolean }[] }]
      >
    )[0][0];
    const totalCount = createManyArg.data.reduce((a, d) => a + d.count, 0);
    expect(totalCount).toBe(2);
    expect(createManyArg.data.every((d) => d.isRevealed === true)).toBe(true);
  });

  it('gaveUpAt으로 마감된 로그를 focus-only로 재기록하고 잔여와 중복 없이 합산한다', async () => {
    // [실제 불변식] timer.giveUp이 같은 트랜잭션에서 열린 로그를 gaveUpAt으로 마감(총량 기록)한 뒤
    // calculateAndSaveForGiveUp를 호출하므로, 이 시점 로그는 항상 닫혀 있고(returnedAt=gaveUpAt)
    // 로그 구간[escapedAt, gaveUpAt]과 give-up 잔여[gaveUpAt, end]는 겹치지 않는다(이중합산 불가).
    const escapedAt = T0 + 20 * 60 * 1000; // 20분 이탈
    const localGaveUp = T0 + 35 * 60 * 1000; // 35분 포기 → 로그도 이 시각으로 마감
    roomFindUnique.mockResolvedValue(
      buildRoom({
        id: MEMBER_ID,
        gaveUpAt: new Date(localGaveUp),
        escapeLogs: [
          {
            id: 'l1',
            escapedAt: new Date(escapedAt),
            returnedAt: new Date(localGaveUp),
            durationMs: 15 * 60 * 1000, // timer가 기록한 '총량' 15분(휴식 포함)
          },
        ],
      }),
    );

    await service.calculateAndSaveForGiveUp(ROOM_CODE, MEMBER_ID);

    // 로그 [20,35]: 휴식[25,30] 제외 focus-only = 5(R0) + 5(R1) = 10분 → durationMs 재기록.
    const logFocusMs = 10 * 60 * 1000; // 600,000
    expect(tx.escapeLog.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { durationMs: logFocusMs },
    });

    // give-up 잔여 [35분~끝]∩focus = 20(R1) + 25(R2) + 25(R3) = 70분. 로그[20,35]와 무중복.
    const residualMs = 70 * 60 * 1000; // 4,200,000
    expect(tx.roomResult.create).toHaveBeenCalledWith({
      data: {
        roomMemberId: MEMBER_ID,
        roomCode: ROOM_CODE,
        totalEscapeMs: logFocusMs + residualMs, // 4,800,000 (이중합산 아님)
        penaltyTier: 3,
      },
    });
  });

  it('멱등성: 이미 결과가 존재하면 생성하지 않는다', async () => {
    tx.roomResult.findUnique.mockResolvedValue({ roomMemberId: MEMBER_ID });
    roomFindUnique.mockResolvedValue(
      buildRoom({
        id: MEMBER_ID,
        gaveUpAt: new Date(GAVE_UP_AT),
        escapeLogs: [],
      }),
    );

    await service.calculateAndSaveForGiveUp(ROOM_CODE, MEMBER_ID);

    expect(tx.roomResult.create).not.toHaveBeenCalled();
    expect(tx.resultPenalty.createMany).not.toHaveBeenCalled();
  });
});

describe('PenaltyService.calculateAndSave (give-up 종료 시 재산정)', () => {
  let service: PenaltyService;
  let roomFindUnique: jest.Mock;
  let resultFindMany: jest.Mock;
  let tx: {
    escapeLog: { update: jest.Mock };
    roomResult: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    resultPenalty: { createMany: jest.Mock };
  };

  beforeEach(() => {
    roomFindUnique = jest.fn();
    // give-up 멤버는 포기 시점에 임시 결과가 이미 생성됨 → processedIds 포함.
    resultFindMany = jest.fn().mockResolvedValue([{ roomMemberId: MEMBER_ID }]);
    tx = {
      escapeLog: { update: jest.fn() },
      roomResult: {
        findUnique: jest.fn().mockResolvedValue({ roomMemberId: MEMBER_ID }),
        create: jest.fn(),
        update: jest.fn(),
      },
      resultPenalty: { createMany: jest.fn() },
    };
    const prismaMock = {
      room: { findUnique: roomFindUnique },
      roomResult: { findMany: resultFindMany },
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    service = new PenaltyService(prismaMock as unknown as PrismaService);
  });

  it('조기 종료 시 give-up 멤버를 실제 종료 anchor로 재산정(update)하고 벌칙은 보존한다', async () => {
    const ENDED_AT = T0 + 40 * 60 * 1000; // 계획 115분이나 40분에 강제 종료
    roomFindUnique.mockResolvedValue({
      code: ROOM_CODE,
      startedAt: new Date(T0),
      endedAt: new Date(ENDED_AT),
      template: {
        focusMin: 25,
        breakMin: 5,
        rounds: 4,
        tierConfig: { tiers: DEFAULT_TIERS },
        penalties: POOL,
      },
      roomMembers: [
        { id: MEMBER_ID, gaveUpAt: new Date(GAVE_UP_AT), escapeLogs: [] },
      ],
    });

    await service.calculateAndSave(ROOM_CODE);

    // 잔여 [10,40]∩focus = R0[10,25]15 + R1[30,40]10 = 25분 → 25% → tier 2.
    // (포기 시점 계획 anchor였다면 90분/tier3이었을 값을 실제 종료로 보정)
    const residualMs = 25 * 60 * 1000; // 1,500,000
    expect(tx.roomResult.update).toHaveBeenCalledWith({
      where: { roomMemberId: MEMBER_ID },
      data: { totalEscapeMs: residualMs, penaltyTier: 2 },
    });
    // 벌칙 행(개수=최대)은 재생성/재롤링 없이 보존
    expect(tx.roomResult.create).not.toHaveBeenCalled();
    expect(tx.resultPenalty.createMany).not.toHaveBeenCalled();
  });
});
