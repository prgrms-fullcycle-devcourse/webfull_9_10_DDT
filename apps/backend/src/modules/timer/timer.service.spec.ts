// nanoid 5.x는 ESM 전용이라 ts-jest 변환 대상에서 제외됨.
// RoomService가 transitive로 nanoid를 import하므로 테스트에서는 mock 처리한다.
jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));
jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }));
// web-push: TimerService 생성자가 setVapidDetails를 호출하는데 테스트 환경엔
// VAPID 키가 없어 실 모듈은 검증 throw한다. 산정/타이머 로직과 무관하므로 mock 처리.
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue(undefined),
}));

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Test } from '@nestjs/testing';
import { TimerService } from './timer.service';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { RoomGateway } from '../gateway/room/room.gateway';
import { RoomService } from '../room/room.service';
import { PenaltyService } from '../penalty/penalty.service';
import { YjsGateway } from '../gateway/yjs/yjs.gateway';

const HOST_ID = 'host-1';
const ROOM_CODE = 'TESTCODE';

type MemberFlags = { isHost?: boolean; isSigned?: boolean };

function buildRawState(members: Record<string, MemberFlags>): string {
  return JSON.stringify({
    roomCode: ROOM_CODE,
    hostId: HOST_ID,
    phase: 'contract',
    members,
  });
}

describe('TimerService.forceStartTimer (미서명자 강퇴 로직)', () => {
  let service: TimerService;

  const redisGet = jest.fn();
  const kickMember = jest.fn();
  const roomUpdate = jest.fn();
  const roomFindUnique = jest.fn();

  let socketEmit: jest.Mock;
  let socketDisconnect: jest.Mock;
  let fetchSockets: jest.Mock;
  let roomEmit: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    socketEmit = jest.fn();
    socketDisconnect = jest.fn();
    roomEmit = jest.fn();

    fetchSockets = jest.fn().mockResolvedValue([
      {
        data: { userId: 'guest_unsigned' },
        emit: socketEmit,
        disconnect: socketDisconnect,
      },
      {
        data: { userId: 'member_unsigned' },
        emit: socketEmit,
        disconnect: socketDisconnect,
      },
    ]);

    roomFindUnique.mockResolvedValue({
      code: ROOM_CODE,
      hostId: HOST_ID,
      phase: 'contract',
      template: { focusMin: 25, breakMin: 5, rounds: 4, penalties: [] },
    });
    kickMember.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        TimerService,
        {
          provide: PrismaService,
          useValue: {
            room: { findUnique: roomFindUnique, update: roomUpdate },
          },
        },
        { provide: RedisService, useValue: { instance: { get: redisGet } } },
        {
          provide: RoomGateway,
          useValue: {
            server: {
              in: jest.fn().mockReturnValue({ fetchSockets }),
              to: jest.fn().mockReturnValue({ emit: roomEmit }),
            },
          },
        },
        {
          provide: RoomService,
          useValue: { kickMember, updateRedisPhase: jest.fn() },
        },
        { provide: PenaltyService, useValue: {} },
        { provide: YjsGateway, useValue: { destroyRoom: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(TimerService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── 권한/존재 검증 ────────────────────────────────────────────────

  it('비방장이 호출하면 403을 던지고 강퇴/시작을 수행하지 않는다', async () => {
    roomFindUnique.mockResolvedValue({ code: ROOM_CODE, hostId: HOST_ID });

    await expect(
      service.forceStartTimer(ROOM_CODE, 'not-host'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(kickMember).not.toHaveBeenCalled();
    expect(roomUpdate).not.toHaveBeenCalled();
    expect(roomEmit).not.toHaveBeenCalledWith(
      'session:started',
      expect.anything(),
    );
  });

  it('방이 없으면 404를 던진다', async () => {
    roomFindUnique.mockResolvedValue(null);

    await expect(
      service.forceStartTimer(ROOM_CODE, HOST_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('contract phase가 아니면 423 LOCKED를 던지고 강퇴/시작을 수행하지 않는다', async () => {
    roomFindUnique.mockResolvedValue({
      code: ROOM_CODE,
      hostId: HOST_ID,
      phase: 'timer',
      template: { focusMin: 25, breakMin: 5, rounds: 4, penalties: [] },
    });

    const err: unknown = await service
      .forceStartTimer(ROOM_CODE, HOST_ID)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(HttpStatus.LOCKED);
    expect(kickMember).not.toHaveBeenCalled();
    expect(roomUpdate).not.toHaveBeenCalled();
  });

  // ── Redis null fail-closed ────────────────────────────────────────

  it('Redis 상태가 없으면 fail-closed로 차단되어 세션이 시작되지 않는다', async () => {
    redisGet.mockResolvedValue(null);

    await expect(
      service.forceStartTimer(ROOM_CODE, HOST_ID),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(kickMember).not.toHaveBeenCalled();
    expect(roomUpdate).not.toHaveBeenCalled();
    expect(roomEmit).not.toHaveBeenCalledWith(
      'session:started',
      expect.anything(),
    );
  });

  // ── 정상 강퇴 분기 ────────────────────────────────────────────────

  it('미서명 + 비방장 멤버는 강퇴되고 kickedMemberIds에 포함된다', async () => {
    redisGet
      .mockResolvedValueOnce(
        buildRawState({
          [HOST_ID]: { isHost: true, isSigned: true },
          guest_unsigned: { isHost: false, isSigned: false },
        }),
      )
      .mockResolvedValue(
        buildRawState({ [HOST_ID]: { isHost: true, isSigned: true } }),
      );

    const result = await service.forceStartTimer(ROOM_CODE, HOST_ID);

    expect(kickMember).toHaveBeenCalledWith(ROOM_CODE, 'guest_unsigned');
    expect(result.kickedMemberIds).toEqual(['guest_unsigned']);
    expect(roomEmit).toHaveBeenCalledWith('member:kicked', {
      targetId: 'guest_unsigned',
    });
  });

  it('방장(isHost)이 미서명이면 강제 시작도 차단된다 (방장은 강퇴 불가)', async () => {
    redisGet.mockResolvedValue(
      buildRawState({
        [HOST_ID]: { isHost: true, isSigned: false },
        guest_unsigned: { isHost: false, isSigned: false },
      }),
    );

    await expect(
      service.forceStartTimer(ROOM_CODE, HOST_ID),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(kickMember).not.toHaveBeenCalled();
    expect(roomUpdate).not.toHaveBeenCalled();
    expect(roomEmit).not.toHaveBeenCalledWith(
      'session:started',
      expect.anything(),
    );
  });

  it('isSigned 필드가 아예 없는(미설정) 멤버도 강퇴 대상이다', async () => {
    redisGet
      .mockResolvedValueOnce(
        buildRawState({
          [HOST_ID]: { isHost: true, isSigned: true },
          guest_unsigned: { isHost: false },
        }),
      )
      .mockResolvedValue(
        buildRawState({ [HOST_ID]: { isHost: true, isSigned: true } }),
      );

    const result = await service.forceStartTimer(ROOM_CODE, HOST_ID);

    expect(kickMember).toHaveBeenCalledWith(ROOM_CODE, 'guest_unsigned');
    expect(result.kickedMemberIds).toEqual(['guest_unsigned']);
  });

  it('서명을 완료한 멤버는 강퇴되지 않는다', async () => {
    redisGet.mockResolvedValue(
      buildRawState({
        [HOST_ID]: { isHost: true, isSigned: true },
        member_signed: { isHost: false, isSigned: true },
      }),
    );

    const result = await service.forceStartTimer(ROOM_CODE, HOST_ID);

    expect(kickMember).not.toHaveBeenCalled();
    expect(result.kickedMemberIds).toEqual([]);
  });

  it('강퇴 대상 소켓에 kicked emit 후 disconnect 된다 (게스트 포함)', async () => {
    redisGet
      .mockResolvedValueOnce(
        buildRawState({
          [HOST_ID]: { isHost: true, isSigned: true },
          guest_unsigned: { isHost: false, isSigned: false },
          member_unsigned: { isHost: false, isSigned: false },
        }),
      )
      .mockResolvedValue(
        buildRawState({ [HOST_ID]: { isHost: true, isSigned: true } }),
      );

    const result = await service.forceStartTimer(ROOM_CODE, HOST_ID);

    expect(result.kickedMemberIds).toEqual([
      'guest_unsigned',
      'member_unsigned',
    ]);
    expect(socketEmit).toHaveBeenCalledWith('kicked');
    expect(socketEmit).toHaveBeenCalledTimes(2);

    expect(socketDisconnect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(socketDisconnect).toHaveBeenCalledTimes(2);
  });

  // ── A′ 실패 처리 (재시도 + fail-closed) ──────────────────────────

  it('재시도(2회) 후에도 강퇴 실패하면 500을 던지고 세션을 시작하지 않는다', async () => {
    kickMember.mockRejectedValue(new Error('redis down'));
    redisGet.mockResolvedValueOnce(
      buildRawState({
        [HOST_ID]: { isHost: true, isSigned: true },
        guest_unsigned: { isHost: false, isSigned: false },
      }),
    );

    await expect(
      service.forceStartTimer(ROOM_CODE, HOST_ID),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(kickMember).toHaveBeenCalledTimes(3);
    expect(roomUpdate).not.toHaveBeenCalled();
    expect(roomEmit).not.toHaveBeenCalledWith(
      'session:started',
      expect.anything(),
    );
  });

  it('이중 안전장치: 강퇴 성공해도 재검사 시 미서명자가 남아있으면 500을 던진다', async () => {
    redisGet
      .mockResolvedValueOnce(
        buildRawState({
          [HOST_ID]: { isHost: true, isSigned: true },
          guest_unsigned: { isHost: false, isSigned: false },
        }),
      )
      .mockResolvedValue(
        buildRawState({
          [HOST_ID]: { isHost: true, isSigned: true },
          member_reset: { isHost: false, isSigned: false },
        }),
      );

    await expect(
      service.forceStartTimer(ROOM_CODE, HOST_ID),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(kickMember).toHaveBeenCalledWith(ROOM_CODE, 'guest_unsigned');
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(roomUpdate).not.toHaveBeenCalled();
    expect(roomEmit).not.toHaveBeenCalledWith(
      'session:started',
      expect.anything(),
    );
  });

  it('⑤ phase 전환(room.update) 실패 시 Sentry 기록 후 500을 던지고 세션을 시작하지 않는다', async () => {
    // 전원 서명 상태 → 강퇴 대상 없이 바로 phase 전환 단계로 진입
    redisGet.mockResolvedValue(
      buildRawState({ [HOST_ID]: { isHost: true, isSigned: true } }),
    );
    roomUpdate.mockRejectedValue(new Error('db down'));

    await expect(
      service.forceStartTimer(ROOM_CODE, HOST_ID),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(Sentry.captureException).toHaveBeenCalled();
    expect(roomEmit).not.toHaveBeenCalledWith(
      'session:started',
      expect.anything(),
    );
  });
});

describe('TimerService.giveUp (중도 포기)', () => {
  let service: TimerService;

  const memberFindFirst = jest.fn();
  const txMemberUpdate = jest.fn();
  const calcGiveUp = jest.fn();
  let roomEmit: jest.Mock;

  function buildMember(overrides: Record<string, unknown> = {}) {
    return {
      id: 'm1',
      userId: 'u1',
      roomCode: ROOM_CODE,
      gaveUpAt: null,
      room: { phase: 'timer' },
      ...overrides,
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    roomEmit = jest.fn();
    calcGiveUp.mockResolvedValue(undefined);

    const $transaction = jest.fn((cb: (tx: unknown) => unknown) =>
      cb({
        escapeLog: {
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn(),
        },
        roomMember: { update: txMemberUpdate },
      }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        TimerService,
        {
          provide: PrismaService,
          useValue: {
            roomMember: { findFirst: memberFindFirst },
            $transaction,
          },
        },
        { provide: RedisService, useValue: { instance: { get: jest.fn() } } },
        {
          provide: RoomGateway,
          useValue: {
            server: { to: jest.fn().mockReturnValue({ emit: roomEmit }) },
          },
        },
        {
          provide: RoomService,
          useValue: { kickMember: jest.fn(), updateRedisPhase: jest.fn() },
        },
        {
          provide: PenaltyService,
          useValue: { calculateAndSaveForGiveUp: calcGiveUp },
        },
        { provide: YjsGateway, useValue: { destroyRoom: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(TimerService);
  });

  it('정상 포기 시 단독 산정을 호출하고 member:gave-up을 브로드캐스트한다', async () => {
    memberFindFirst.mockResolvedValue(buildMember());

    const res = await service.giveUp(ROOM_CODE, 'u1');

    expect(calcGiveUp).toHaveBeenCalledWith(ROOM_CODE, 'm1');
    expect(roomEmit).toHaveBeenCalledWith(
      'member:gave-up',
      expect.objectContaining({ userId: 'u1' }),
    );
    expect(res).toEqual(expect.objectContaining({ userId: 'u1' }));
  });

  it('산정이 실패해도 포기 흐름을 완주한다 (브로드캐스트 + Sentry 기록)', async () => {
    memberFindFirst.mockResolvedValue(buildMember());
    calcGiveUp.mockRejectedValue(new Error('calc fail'));

    await expect(service.giveUp(ROOM_CODE, 'u1')).resolves.toEqual(
      expect.objectContaining({ userId: 'u1' }),
    );

    expect(Sentry.captureException).toHaveBeenCalled();
    expect(roomEmit).toHaveBeenCalledWith(
      'member:gave-up',
      expect.objectContaining({ userId: 'u1' }),
    );
  });

  it('timer phase가 아니면 409를 던지고 산정하지 않는다', async () => {
    memberFindFirst.mockResolvedValue(
      buildMember({ room: { phase: 'result' } }),
    );

    await expect(service.giveUp(ROOM_CODE, 'u1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(calcGiveUp).not.toHaveBeenCalled();
  });

  it('이미 포기한 멤버는 409를 던진다', async () => {
    memberFindFirst.mockResolvedValue(
      buildMember({ gaveUpAt: new Date('2026-06-01T00:05:00.000Z') }),
    );

    await expect(service.giveUp(ROOM_CODE, 'u1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(calcGiveUp).not.toHaveBeenCalled();
  });

  it('멤버가 없으면 404를 던진다', async () => {
    memberFindFirst.mockResolvedValue(null);

    await expect(service.giveUp(ROOM_CODE, 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
