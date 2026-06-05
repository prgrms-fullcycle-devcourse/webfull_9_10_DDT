import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { RoomGateway } from '../gateway/room/room.gateway';
import { RoomService } from '../room/room.service';
import { PenaltyService } from '../penalty/penalty.service';
import { YjsGateway } from '../gateway/yjs/yjs.gateway';
import * as webpush from 'web-push';

// 강퇴 재시도 횟수 (총 시도 = 1 + KICK_MAX_RETRIES). kickMember는 멱등이라 재시도 안전.
const KICK_MAX_RETRIES = 2;
// 강퇴 대상 소켓 disconnect 지연(ms) — kicked 이벤트 수신 여유 확보.
const KICK_DISCONNECT_DELAY_MS = 100;

type RoomStateMembers = Record<
  string,
  { isSigned?: boolean; isHost?: boolean }
>;

type UnsignedSummary = {
  hostUnsigned: boolean;
  memberIds: string[];
};

function extractUnsignedSummary(rawState: string | null): UnsignedSummary {
  if (!rawState) return { hostUnsigned: false, memberIds: [] };
  const state = JSON.parse(rawState) as { members?: RoomStateMembers };
  const entries = Object.entries(state.members ?? {});
  return {
    hostUnsigned: entries.some(([, m]) => m.isHost && !m.isSigned),
    memberIds: entries
      .filter(([, m]) => !m.isHost && !m.isSigned)
      .map(([key]) => key),
  };
}

@Injectable()
export class TimerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly roomGateway: RoomGateway,
    private readonly roomService: RoomService,
    private readonly penaltyService: PenaltyService,
    private readonly yjsGateway: YjsGateway,
  ) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  }
  async savePushSubscription(
    roomCode: string,
    userId: string,
    subscription: any,
  ) {
    await this.redis.instance.set(
      `push_sub:${roomCode}:${userId}`,
      JSON.stringify(subscription),
      'EX',
      7200,
    );
  }

  private async sendPushToRoom(roomCode: string, title: string, body: string) {
    const rawState = await this.redis.instance.get(`room:state:${roomCode}`);
    if (!rawState) return;

    const state = JSON.parse(rawState) as { members?: Record<string, unknown> };
    if (!state.members) return;

    const userIds = Object.keys(state.members);

    const payload = JSON.stringify({ title, body });

    for (const userId of userIds) {
      const subRaw = await this.redis.instance.get(
        `push_sub:${roomCode}:${userId}`,
      );
      if (subRaw) {
        const subscription = JSON.parse(subRaw) as webpush.PushSubscription;
        webpush
          .sendNotification(subscription, payload)
          .catch((err: unknown) => {
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            console.error(`푸시 전송 실패 (${userId}):`, errorMessage);
          });
      }
    }
  }

  private async verifyHost(roomCode: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
    });
    if (!room) throw new NotFoundException('방을 찾을 수 없습니다.');
    if (room.hostId !== userId)
      throw new ForbiddenException('방장 권한이 필요합니다.');
    return room;
  }

  private ensureContractPhase(phase: string) {
    if (phase !== 'contract') {
      throw new HttpException(
        { message: '계약서 단계에서만 시작할 수 있습니다.', error: 'LOCKED' },
        HttpStatus.LOCKED,
      );
    }
  }

  private async kickWithRetry(
    roomCode: string,
    targetId: string,
  ): Promise<void> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= KICK_MAX_RETRIES; attempt++) {
      try {
        await this.roomService.kickMember(roomCode, targetId);
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  }

  async startTimer(roomCode: string, userId: string) {
    const room = await this.verifyHost(roomCode, userId);
    this.ensureContractPhase(room.phase);

    const roomWithTemplate = await this.prisma.room.findUnique({
      where: { code: roomCode },
      include: { template: true },
    });

    if (!roomWithTemplate?.template) {
      throw new NotFoundException('계약서가 없습니다.');
    }

    const rawState = await this.redis.instance.get(`room:state:${roomCode}`);
    // room:state가 없으면(TTL 만료/Redis 장애) 서명 여부를 검증할 수 없다.
    // 정상 시작은 "전원 서명"이 전제이므로 fail-closed로 차단한다.
    if (!rawState) {
      throw new ConflictException(
        '방 상태를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.',
      );
    }

    const { hostUnsigned, memberIds } = extractUnsignedSummary(rawState);
    if (hostUnsigned) {
      throw new BadRequestException(
        '방장이 서명을 완료해야 시작할 수 있습니다.',
      );
    }
    if (memberIds.length > 0) {
      throw new BadRequestException(
        '아직 서명하지 않은 멤버가 있습니다. 강제 시작을 사용해주세요.',
      );
    }

    const now = new Date();
    await this.prisma.room.update({
      where: { code: roomCode },
      data: { phase: 'timer', startedAt: now },
    });

    await this.roomService.updateRedisPhase(roomCode, 'timer');

    const responseData = {
      startedAt: now,
      focusMin: roomWithTemplate.template.focusMin,
      breakMin: roomWithTemplate.template.breakMin,
      totalRounds: roomWithTemplate.template.rounds,
      serverTime: now,
    };

    this.yjsGateway.destroyRoom(roomCode);

    this.roomGateway.server.to(roomCode).emit('session:started', responseData);

    const { focusMin, breakMin, rounds } = roomWithTemplate.template;
    for (let r = 1; r < rounds; r++) {
      const notifyTimeMs = ((focusMin + breakMin) * r - 1) * 60 * 1000;

      if (notifyTimeMs > 0) {
        setTimeout(() => {
          this.sendPushToRoom(
            roomCode,
            '휴식이 1분 남았어요! ⏰',
            '곧 집중 시간이 시작됩니다. 자리에 앉아주세요!',
          ).catch(console.error);
        }, notifyTimeMs);
      }
    }

    const totalMs =
      (roomWithTemplate.template.focusMin +
        roomWithTemplate.template.breakMin) *
      roomWithTemplate.template.rounds *
      60 *
      1000;

    setTimeout(() => {
      this.endSession(roomCode).catch((err) => Sentry.captureException(err));
    }, totalMs);
    return responseData;
  }

  async forceStartTimer(roomCode: string, userId: string) {
    const room = await this.verifyHost(roomCode, userId);
    this.ensureContractPhase(room.phase);

    const roomWithTemplate = await this.prisma.room.findUnique({
      where: { code: roomCode },
      include: { template: true },
    });

    if (!roomWithTemplate?.template) {
      throw new NotFoundException('계약서가 없습니다.');
    }

    const kickedMemberIds: string[] = [];
    const failedMemberIds: string[] = [];

    const rawState = await this.redis.instance.get(`room:state:${roomCode}`);
    // room:state가 없으면(TTL 만료/Redis 장애) 서명 여부를 검증할 수 없다.
    // null이면 extractUnsignedSummary가 미서명자 0건을 반환해 강퇴 없이 시작되므로,
    // startTimer와 동일하게 fail-closed로 차단한다.
    if (!rawState) {
      throw new ConflictException(
        '방 상태를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.',
      );
    }

    const { hostUnsigned, memberIds: targetIds } =
      extractUnsignedSummary(rawState);

    // 방장은 강퇴 대상이 아니므로, 방장이 미서명이면 강제 시작도 불가하다.
    if (hostUnsigned) {
      throw new BadRequestException(
        '방장이 서명을 완료해야 시작할 수 있습니다.',
      );
    }

    if (targetIds.length > 0) {
      const sockets = await this.roomGateway.server.in(roomCode).fetchSockets();

      for (const targetId of targetIds) {
        try {
          await this.kickWithRetry(roomCode, targetId);
        } catch (err) {
          Sentry.captureException(err);
          failedMemberIds.push(targetId);
          continue;
        }

        const targetSocket = sockets.find((s) => s.data.userId === targetId);
        if (targetSocket) {
          targetSocket.emit('kicked');
          setTimeout(() => targetSocket.disconnect(), KICK_DISCONNECT_DELAY_MS);
        }

        this.roomGateway.server
          .to(roomCode)
          .emit('member:kicked', { targetId });
        kickedMemberIds.push(targetId);
      }

      // 1차 게이트: 강퇴 실패 멤버가 있으면 세션 시작 차단 (fail-closed)
      if (failedMemberIds.length > 0) {
        throw new InternalServerErrorException(
          '일부 멤버 강퇴에 실패했습니다. 다시 시도해주세요.',
        );
      }

      // 2차 게이트: phase 전환 직전 최신 state 재검사 (동시 unsign 재발생 차단)
      const freshState = await this.redis.instance.get(
        `room:state:${roomCode}`,
      );
      const fresh = extractUnsignedSummary(freshState);
      if (fresh.hostUnsigned || fresh.memberIds.length > 0) {
        Sentry.captureException(
          new Error(
            `force-start 2차 게이트 차단: 강퇴 후에도 미서명자 잔존 ` +
              `(room=${roomCode}, hostUnsigned=${fresh.hostUnsigned}, ` +
              `members=${fresh.memberIds.join(',')})`,
          ),
        );
        throw new InternalServerErrorException(
          '일부 멤버 강퇴에 실패했습니다. 다시 시도해주세요.',
        );
      }
    }

    const now = new Date();
    try {
      await this.prisma.room.update({
        where: { code: roomCode },
        data: { phase: 'timer', startedAt: now },
      });
    } catch (err) {
      Sentry.captureException(err);
      throw new InternalServerErrorException(
        '세션 시작 중 오류가 발생했습니다. 다시 시도해주세요.',
      );
    }

    await this.roomService.updateRedisPhase(roomCode, 'timer');

    const responseData = {
      kickedMemberIds,
      startedAt: now,
      focusMin: roomWithTemplate.template.focusMin,
      breakMin: roomWithTemplate.template.breakMin,
      totalRounds: roomWithTemplate.template.rounds,
      serverTime: now,
    };

    this.yjsGateway.destroyRoom(roomCode);
    this.roomGateway.server.to(roomCode).emit('session:started', responseData);

    const totalMs =
      (roomWithTemplate.template.focusMin +
        roomWithTemplate.template.breakMin) *
      roomWithTemplate.template.rounds *
      60 *
      1000;

    setTimeout(() => {
      this.endSession(roomCode).catch((err) => Sentry.captureException(err));
    }, totalMs);

    return responseData;
  }

  async giveUp(roomCode: string, userId: string) {
    const isGuest = userId.startsWith('guest_');
    const member = await this.prisma.roomMember.findFirst({
      where: {
        roomCode,
        ...(isGuest ? { guestToken: userId } : { userId }),
      },
      include: { room: true },
    });

    if (!member)
      throw new NotFoundException('방 참여 정보를 찾을 수 없습니다.');
    if (member.room.phase !== 'timer')
      throw new ConflictException('집중 진행 중에만 중도 포기할 수 있습니다.');
    if (member.gaveUpAt)
      throw new ConflictException('이미 중도 포기한 상태입니다.');

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // 탈주(중도 포기) 벌칙 산정은 PenaltyService.calculateAndSave(gaveUpAt 분기)에서 처리됨.
      // 여기선 포기 멤버의 열린 EscapeLog를 durationMs까지 계산해 마감.
      const openLogs = await tx.escapeLog.findMany({
        where: { roomMemberId: member.id, returnedAt: null, deletedAt: null },
        select: { id: true, escapedAt: true },
      });
      for (const log of openLogs) {
        await tx.escapeLog.update({
          where: { id: log.id },
          data: {
            returnedAt: now,
            durationMs: now.getTime() - log.escapedAt.getTime(),
          },
        });
      }

      await tx.roomMember.update({
        where: { id: member.id },
        data: { gaveUpAt: now },
      });
    });

    const responseData = { userId, gaveUpAt: now };
    this.roomGateway.server.to(roomCode).emit('member:gave-up', responseData);

    return responseData;
  }

  async endSession(roomCode: string) {
    await this.prisma.room.update({
      where: { code: roomCode },
      data: { phase: 'result', endedAt: new Date() },
    });

    await this.roomService.updateRedisPhase(roomCode, 'result');
    await this.penaltyService.calculateAndSave(roomCode);

    this.roomGateway.server.to(roomCode).emit('session:ended', {
      endedAt: new Date(),
    });
  }
}
