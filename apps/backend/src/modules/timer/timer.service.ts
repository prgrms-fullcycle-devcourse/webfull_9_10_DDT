import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { RoomGateway } from '../gateway/room/room.gateway';
import { RoomService } from '../room/room.service';
import { PenaltyService } from '../penalty/penalty.service';
import { YjsGateway } from '../gateway/yjs/yjs.gateway';
import * as webpush from 'web-push';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { PushSubscription } from 'web-push';
import {
  SESSION_QUEUE,
  SessionJob,
  endJobId,
  warnJobId,
  breakStartJobId,
} from './timer.queue';
import { EscapeService } from '../escape/escape.service';

// 강퇴 재시도 횟수 (총 시도 = 1 + KICK_MAX_RETRIES). kickMember는 멱등이라 재시도 안전.
const KICK_MAX_RETRIES = 2;
// 강퇴 대상 소켓 disconnect 지연(ms) — kicked 이벤트 수신 여유 확보.
const KICK_DISCONNECT_DELAY_MS = 100;

const PUSH_SUB_TTL_SEC = 11 * 60 * 60;
const MAX_ROUNDS_FALLBACK = 30;

type SessionTemplate = {
  focusMin: number;
  breakMin: number;
  rounds: number;
};

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
export class TimerService implements OnModuleInit {
  private readonly logger = new Logger(TimerService.name);
  private pushEnabled = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly roomGateway: RoomGateway,
    private readonly roomService: RoomService,
    private readonly penaltyService: PenaltyService,
    private readonly yjsGateway: YjsGateway,
    @InjectQueue(SESSION_QUEUE)
    private readonly sessionQueue: Queue<SessionJob>,
    private readonly configService: ConfigService,
    private readonly escapeService: EscapeService,
  ) {
    const subject = this.configService.get<string>('VAPID_SUBJECT');
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

    if (subject && publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.pushEnabled = true;
    } else {
      this.logger.warn('VAPID 설정 누락 - 푸시 알림이 비활성화됩니다.');
    }
  }

  async savePushSubscription(
    roomCode: string,
    userId: string,
    subscription: PushSubscription,
  ) {
    this.logger.log(`[Push] 구독 저장 (room=${roomCode}, user=${userId})`);
    await this.redis.instance.set(
      `push_sub:${roomCode}:${userId}`,
      JSON.stringify(subscription),
      'EX',
      PUSH_SUB_TTL_SEC,
    );
  }

  private async sendPushToRoom(roomCode: string, title: string, body: string) {
    if (!this.pushEnabled) {
      return;
    }
    const rawState = await this.redis.instance.get(`room:state:${roomCode}`);
    if (!rawState) return;

    const state = JSON.parse(rawState) as { members?: Record<string, unknown> };
    if (!state.members) return;

    const userIds = Object.keys(state.members);

    const payload = JSON.stringify({ title, body });

    await Promise.all(
      userIds.map(async (userId) => {
        const subRaw = await this.redis.instance.get(
          `push_sub:${roomCode}:${userId}`,
        );
        this.logger.log(`[Push] 구독 조회 (user=${userId}, found=${!!subRaw})`);
        if (!subRaw) return;
        const subscription = JSON.parse(subRaw) as PushSubscription;
        await webpush
          .sendNotification(subscription, payload)
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`푸시 전송 실패 (${userId}): ${msg}`);
          });
      }),
    );
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

  private getSessionDurationMs(template: {
    focusMin: number;
    breakMin: number;
    rounds: number;
  }) {
    return (
      (template.focusMin * template.rounds +
        template.breakMin * Math.max(0, template.rounds - 1)) *
      60 *
      1000
    );
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
    let lastErr: unknown = new Error('강퇴 재시도 횟수 초과');
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

    const template = await this.loadRoomTemplate(roomCode);
    const { memberIds } = await this.loadSignState(roomCode);

    if (memberIds.length > 0) {
      throw new BadRequestException(
        '아직 서명하지 않은 멤버가 있습니다. 강제 시작을 사용해주세요.',
      );
    }

    return this.beginSession(roomCode, template);
  }

  async forceStartTimer(roomCode: string, userId: string) {
    const room = await this.verifyHost(roomCode, userId);
    this.ensureContractPhase(room.phase);

    const template = await this.loadRoomTemplate(roomCode);
    const { memberIds: targetIds } = await this.loadSignState(roomCode);
    const kickedMemberIds: string[] = [];

    if (targetIds.length > 0) {
      const failedMemberIds: string[] = [];
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
          await new Promise<void>((resolve) =>
            setTimeout(() => {
              targetSocket.disconnect();
              resolve();
            }, KICK_DISCONNECT_DELAY_MS),
          );
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

    return this.beginSession(roomCode, template, { kickedMemberIds });
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
      await this.closeOpenEscapeLogs(tx, member.id, now);

      await tx.roomMember.update({
        where: { id: member.id },
        data: { gaveUpAt: now },
      });
    });

    await this.safeCalculateForGiveUp(roomCode, member.id);

    const raw = await this.redis.instance.get(`room:state:${roomCode}`);
    if (raw) {
      const state = JSON.parse(raw) as {
        members: Record<string, { gaveUpAt?: string | null }>;
      };
      if (state.members[userId]) {
        state.members[userId].gaveUpAt = now.toISOString();
        await this.redis.instance.set(
          `room:state:${roomCode}`,
          JSON.stringify(state),
          'EX',
          86400,
        );
      }
    }

    const sockets = await this.roomGateway.server.in(roomCode).fetchSockets();
    const userSocket = sockets.find((s) => s.data.userId === userId);
    userSocket?.disconnect();

    const responseData = { userId, gaveUpAt: now };
    this.roomGateway.server.to(roomCode).emit('member:gave-up', responseData);

    const activeCount =
      await this.roomService.countActiveMembersInRoom(roomCode);

    if (activeCount === 0) {
      this.logger.log(`모두가 중도 포기했습니다. 방을 종료합니다: ${roomCode}`);
      await this.endSession(roomCode);
    }
    return responseData;
  }

  async endSession(roomCode: string): Promise<void> {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
      select: { phase: true },
    });

    if (!room || room.phase === 'result' || room.phase === 'closed') {
      return;
    }
    const now = new Date();
    await this.prisma.room.update({
      where: { code: roomCode },
      data: { phase: 'result', endedAt: now },
    });

    await this.roomService.updateRedisPhase(roomCode, 'result');
    try {
      await this.penaltyService.calculateAndSave(roomCode);
    } catch (err) {
      Sentry.captureException(err);
      this.logger.error(`세션 결과 저장 실패 (room=${roomCode})`, err as Error);
    }

    await this.cancelSessionJobs(roomCode);
    this.roomGateway.server
      .to(roomCode)
      .emit('session:ended', { endedAt: now });
  }

  async onModuleInit(): Promise<void> {
    const running = await this.prisma.room
      .findMany({
        where: { phase: 'timer' },
        select: {
          code: true,
          startedAt: true,
          template: {
            select: { focusMin: true, breakMin: true, rounds: true },
          },
        },
      })
      .catch((err: unknown) => {
        Sentry.captureException(err);
        this.logger.error('세션 복구 스윕 실패', err as Error);
        return [];
      });

    for (const room of running) {
      if (!room.template || !room.startedAt) continue;
      const totalMs = this.getSessionDurationMs(room.template);
      const remaining = totalMs - (Date.now() - room.startedAt.getTime());

      if (remaining <= 0) {
        await this.endSession(room.code).catch((err: unknown) =>
          Sentry.captureException(err),
        );
      } else {
        await this.sessionQueue
          .add(
            'end',
            { kind: 'end', roomCode: room.code },
            {
              jobId: endJobId(room.code),
              delay: remaining,
              removeOnComplete: true,
              removeOnFail: 100,
            },
          )
          .catch(() => undefined);

        const { focusMin, breakMin, rounds } = room.template;
        for (let r = 1; r < rounds; r++) {
          const notifyTimeMs = ((focusMin + breakMin) * r - 1) * 60 * 1000;
          const targetTime = room.startedAt.getTime() + notifyTimeMs;
          const delay = targetTime - Date.now();

          if (delay > 0) {
            await this.sessionQueue
              .add(
                'break-warning',
                { kind: 'break-warning', roomCode: room.code, round: r },
                {
                  jobId: warnJobId(room.code, r),
                  delay,
                  removeOnComplete: true,
                  removeOnFail: 100,
                },
              )
              .catch(() => undefined);
          }
        }
      }
    }
  }

  // ── Processor 호출용 public 메서드 ───────────────────────────

  async sendBreakWarning(roomCode: string): Promise<void> {
    await this.sendPushToRoom(
      roomCode,
      '휴식이 1분 남았어요! ⏰',
      '곧 집중 시간이 시작됩니다. 자리에 앉아주세요!',
    );
  }

  // ── private 헬퍼 ─────────────────────────────────────────────

  private async loadSignState(roomCode: string): Promise<UnsignedSummary> {
    const rawState = await this.redis.instance.get(`room:state:${roomCode}`);
    if (!rawState) {
      throw new ConflictException(
        '방 상태를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.',
      );
    }
    const summary = extractUnsignedSummary(rawState);
    if (summary.hostUnsigned) {
      throw new BadRequestException(
        '방장이 서명을 완료해야 시작할 수 있습니다.',
      );
    }
    return summary;
  }

  private async loadRoomTemplate(roomCode: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
      include: { template: true },
    });
    if (!room?.template) throw new NotFoundException('계약서가 없습니다.');
    return room.template;
  }

  private async beginSession(
    roomCode: string,
    template: SessionTemplate,
    extra: { kickedMemberIds?: string[] } = {},
  ) {
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
      ...extra,
      startedAt: now,
      focusMin: template.focusMin,
      breakMin: template.breakMin,
      totalRounds: template.rounds,
      serverTime: now,
    };

    await this.scheduleSessionJobs(roomCode, template);
    this.yjsGateway.destroyRoom(roomCode);
    this.roomGateway.server.to(roomCode).emit('session:started', responseData);

    return responseData;
  }

  private async closeOpenEscapeLogs(
    tx: Prisma.TransactionClient,
    roomMemberId: string,
    closedAt: Date,
  ): Promise<void> {
    const openLogs = await tx.escapeLog.findMany({
      where: { roomMemberId, returnedAt: null, deletedAt: null },
      select: { id: true, escapedAt: true },
    });
    await Promise.all(
      openLogs.map((log) =>
        tx.escapeLog.update({
          where: { id: log.id },
          data: {
            returnedAt: closedAt,
            durationMs: closedAt.getTime() - log.escapedAt.getTime(),
          },
        }),
      ),
    );
  }

  private async safeCalculateForGiveUp(
    roomCode: string,
    memberId: string,
  ): Promise<void> {
    try {
      await this.penaltyService.calculateAndSaveForGiveUp(roomCode, memberId);
    } catch (err: unknown) {
      Sentry.captureException(err);
      this.logger.error(
        `give-up 벌칙 산정 실패 (room=${roomCode}, member=${memberId})`,
        err as Error,
      );
    }
  }

  private async scheduleSessionJobs(
    roomCode: string,
    template: SessionTemplate,
  ): Promise<void> {
    await this.cancelSessionJobs(roomCode);

    const { focusMin, breakMin, rounds } = template;
    const totalMs = this.getSessionDurationMs(template);

    await this.sessionQueue.add(
      'end',
      { kind: 'end', roomCode },
      {
        jobId: endJobId(roomCode),
        delay: totalMs,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
    this.logger.log(
      `[BullMQ] 세션 종료 잡 등록 (room=${roomCode}, delay=${totalMs}ms)`,
    );

    for (let r = 1; r < rounds; r++) {
      const notifyTimeMs = ((focusMin + breakMin) * r - 1) * 60 * 1000;
      if (notifyTimeMs <= 0) continue;
      await this.sessionQueue.add(
        'break-warning',
        { kind: 'break-warning', roomCode, round: r },
        {
          jobId: warnJobId(roomCode, r),
          delay: notifyTimeMs,
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );

      const breakStartMs = (focusMin * r + breakMin * (r - 1)) * 60 * 1000;
      await this.sessionQueue.add(
        'break-start',
        { kind: 'break-start', roomCode, round: r },
        {
          jobId: breakStartJobId(roomCode, r),
          delay: breakStartMs,
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );

      this.logger.log(
        `[BullMQ] 휴식 알림 잡 등록 (room=${roomCode}, round=${r}, delay=${notifyTimeMs}ms)`,
      );
    }
  }

  async cancelSessionJobs(roomCode: string): Promise<void> {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
      select: { template: { select: { rounds: true } } },
    });
    const rounds = room?.template?.rounds ?? MAX_ROUNDS_FALLBACK;
    const ids = [
      endJobId(roomCode),
      ...Array.from({ length: rounds }, (_, i) => warnJobId(roomCode, i + 1)),
      ...Array.from({ length: rounds - 1 }, (_, i) =>
        breakStartJobId(roomCode, i + 1),
      ),
    ];
    await Promise.all(
      ids.map((id) => this.sessionQueue.remove(id).catch(() => undefined)),
    );
  }

  async emitEscapeSummary(roomCode: string): Promise<void> {
    const summary = await this.escapeService.getCurrentSummary(roomCode);
    this.roomGateway.server
      .to(roomCode)
      .emit('escape:summary', { members: summary });
  }
}
