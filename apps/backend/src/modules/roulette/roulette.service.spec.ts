import { BadRequestException } from '@nestjs/common';
import { RouletteService } from './roulette.service';
import type { PrismaService } from '../../common/prisma.service';
import type { RoomGateway } from '../gateway/room/room.gateway';
import type { PenaltyService } from '../penalty/penalty.service';

// RoomGateway→RoomService가 transitive로 nanoid(ESM 전용)를 import하므로 mock 처리.
jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));
jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }));

const ROOM_CODE = 'TESTCODE';
const USER_ID = 'u1';
const GAVE_UP_AT = new Date('2026-06-01T00:10:00.000Z');

const TEMPLATE_PENALTIES = [
  { id: 'p1', content: '팔굽혀펴기' },
  { id: 'p2', content: '노래 부르기' },
];

function buildMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    userId: USER_ID,
    gaveUpAt: GAVE_UP_AT,
    result: {
      totalEscapeMs: 6660000,
      penalties: [{ content: '팔굽혀펴기', count: 2, isRevealed: true }],
    },
    room: { template: { penalties: TEMPLATE_PENALTIES } },
    ...overrides,
  };
}

describe('RouletteService.getGiveUpResult', () => {
  let service: RouletteService;
  let memberFindFirst: jest.Mock;
  let calcGiveUp: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    memberFindFirst = jest.fn();
    calcGiveUp = jest.fn().mockResolvedValue(undefined);

    const prismaMock = { roomMember: { findFirst: memberFindFirst } };
    const gatewayMock = { server: { to: jest.fn() } };
    const penaltyMock = { calculateAndSaveForGiveUp: calcGiveUp };

    service = new RouletteService(
      prismaMock as unknown as PrismaService,
      gatewayMock as unknown as RoomGateway,
      penaltyMock as unknown as PenaltyService,
    );
  });

  it('멤버를 찾지 못하면 400', async () => {
    memberFindFirst.mockResolvedValue(null);
    await expect(
      service.getGiveUpResult(ROOM_CODE, USER_ID, null),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('포기하지 않은(gaveUpAt=null) 멤버는 400 (포기자 전용 가드)', async () => {
    memberFindFirst.mockResolvedValue(buildMember({ gaveUpAt: null }));
    await expect(
      service.getGiveUpResult(ROOM_CODE, USER_ID, null),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(calcGiveUp).not.toHaveBeenCalled();
  });

  it('정상: gaveUpAt·totalEscapeMs·penaltyPool·penalties를 반환한다', async () => {
    memberFindFirst.mockResolvedValue(buildMember());

    const result = await service.getGiveUpResult(ROOM_CODE, USER_ID, null);

    expect(result).toEqual({
      gaveUpAt: GAVE_UP_AT,
      totalEscapeMs: 6660000,
      penaltyPool: [
        { itemId: 'p1', content: '팔굽혀펴기' },
        { itemId: 'p2', content: '노래 부르기' },
      ],
      penalties: [{ itemId: 'p1', content: '팔굽혀펴기', count: 2 }],
    });
    // 결과가 이미 존재하므로 fallback 재산정은 호출되지 않음
    expect(calcGiveUp).not.toHaveBeenCalled();
  });

  it('fallback: result 미존재 시 재산정 후 재조회한다', async () => {
    memberFindFirst
      .mockResolvedValueOnce(buildMember({ result: null }))
      .mockResolvedValueOnce(buildMember());

    const result = await service.getGiveUpResult(ROOM_CODE, USER_ID, null);

    expect(calcGiveUp).toHaveBeenCalledWith(ROOM_CODE, 'm1');
    expect(memberFindFirst).toHaveBeenCalledTimes(2);
    expect(result.totalEscapeMs).toBe(6660000);
    expect(result.penalties).toEqual([
      { itemId: 'p1', content: '팔굽혀펴기', count: 2 },
    ]);
  });
});
