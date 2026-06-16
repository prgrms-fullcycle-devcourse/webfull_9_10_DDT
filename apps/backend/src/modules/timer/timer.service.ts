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
import { RoomGateway } from '../gateway/room/room.gateway';
import { RoomService } from '../room/room.service';
import { PenaltyService } from '../penalty/penalty.service';
import { YjsGateway } from '../gateway/yjs/yjs.gateway';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { PushSubscription } from 'web-push';
import {
  SESSION_QUEUE,
  SessionJob,
  endJobId,
  warnJobId,
  breakStartJobId,
  revealJobId,
} from './timer.queue';
import { EscapeService } from '../escape/escape.service';
import { TimerRepository } from './timer.repository';
import { PushNotificationService } from './push-notification.service'; // ✅ 주입
import { OnEvent } from '@nestjs/event-emitter';
import { ROULETTE_TIMEOUT_MS } from '../result/result.service';

const KICK_MAX_RETRIES = 2;
const KICK_DISCONNECT_DELAY_MS = 100;
const MAX_ROUNDS_FALLBACK = 30;

type SessionTemplate = { focusMin: number; breakMin: number; rounds: number };
type RoomStateMembers = Record<
  string,
  { isSigned?: boolean; isHost?: boolean }
>;
type UnsignedSummary = { hostUnsigned: boolean; memberIds: string[] };

/**
 * 서명하지 않은 멤버 정보를 Redis 방 상태에서 추출합니다.
 * 강제 시작 시 미서명 멤버 강퇴 대상을 결정하는 데 사용됩니다.
 *
 * @param rawState - Redis에서 읽은 JSON 문자열
 * @returns 호스트 미서명 여부 + 미서명 멤버 ID 목록
 */
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

/**
 * 타이머 세션 관리 서비스.
 * 세션 시작/종료, 중도포기, BullMQ 잡 스케줄링, 푸시 알림을 담당합니다.
 */
@Injectable()
export class TimerService implements OnModuleInit {
  private readonly logger = new Logger(TimerService.name);

  constructor(
    private readonly timerRepository: TimerRepository,
    private readonly roomGateway: RoomGateway,
    private readonly roomService: RoomService,
    private readonly penaltyService: PenaltyService,
    private readonly yjsGateway: YjsGateway,
    @InjectQueue(SESSION_QUEUE)
    private readonly sessionQueue: Queue<SessionJob>,
    private readonly escapeService: EscapeService,
    private readonly pushService: PushNotificationService, // ✅ 푸시 서비스 주입
  ) {}

  /**
   * 푸시 구독 정보를 저장합니다.
   * PushNotificationService.saveSubscription의 공개 래퍼입니다.
   *
   * @param roomCode - 방 코드
   * @param userId - 유저 ID
   * @param data - 구독 데이터 (web: PushSubscription, android: SNS endpoint)
   * @param platform - 플랫폼 ('web' | 'android')
   */
  async savePushSubscription(
    roomCode: string,
    userId: string,
    data: string | PushSubscription,
    platform: string,
  ) {
    await this.pushService.saveSubscription(roomCode, userId, data, platform);
  }

  /**
   * 요청자가 해당 방의 방장인지 검증합니다.
   *
   * @param roomCode - 방 코드
   * @param userId - 요청자 ID
   * @returns 방 정보 (code, hostId, phase)
   * @throws NotFoundException 방이 없을 때
   * @throws ForbiddenException 방장이 아닐 때
   */
  private async verifyHost(roomCode: string, userId: string) {
    const room = await this.timerRepository.findRoomForVerify(roomCode);
    if (!room) throw new NotFoundException('방을 찾을 수 없습니다.');
    if (room.hostId !== userId)
      throw new ForbiddenException('방장 권한이 필요합니다.');
    return room;
  }

  /**
   * 세션 템플릿으로부터 총 세션 시간(밀리초)을 계산합니다.
   * (집중 × 라운드 + 휴식 × (라운드-1)) × 60 × 1000
   *
   * @param template - 세션 템플릿 (focusMin, breakMin, rounds)
   * @returns 총 세션 시간 (밀리초)
   */
  private getSessionDurationMs(template: SessionTemplate) {
    return (
      (template.focusMin * template.rounds +
        template.breakMin * Math.max(0, template.rounds - 1)) *
      60 *
      1000
    );
  }

  /**
   * 현재 페이즈가 contract인지 검증합니다.
   * 타이머 시작은 각서 단계에서만 가능합니다.
   *
   * @param phase - 현재 방 페이즈
   * @throws HttpException (423 LOCKED) contract가 아닌 경우
   */
  private ensureContractPhase(phase: string) {
    if (phase !== 'contract') {
      throw new HttpException(
        { message: '각서 단계에서만 시작할 수 있습니다.', error: 'LOCKED' },
        HttpStatus.LOCKED,
      );
    }
  }

  /**
   * 멤버 강퇴를 최대 KICK_MAX_RETRIES회 재시도합니다.
   * 동시성 문제로 강퇴가 실패할 수 있어 재시도 로직을 적용합니다.
   *
   * @param roomCode - 방 코드
   * @param targetId - 강퇴 대상 ID
   * @throws 마지막 재시도 실패 시 원본 에러를 throw
   */
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

  /**
   * 타이머를 시작합니다 (전원 서명 완료 시).
   * 미서명 멤버가 있으면 BadRequestException을 던집니다.
   *
   * @param roomCode - 방 코드
   * @param userId - 시작을 요청한 호스트 ID
   */
  async startTimer(roomCode: string, userId: string) {
    const room = await this.verifyHost(roomCode, userId);
    this.ensureContractPhase(room.phase);
    const template = await this.loadRoomTemplate(roomCode);
    const { memberIds } = await this.loadSignState(roomCode);
    if (memberIds.length > 0)
      throw new BadRequestException('아직 서명하지 않은 멤버가 있습니다.');
    return this.beginSession(roomCode, template);
  }

  /**
   * 타이머를 강제 시작합니다 (방장 전용).
   * 미서명 멤버를 자동 강퇴한 후 세션을 시작합니다.
   *
   * @param roomCode - 방 코드
   * @param userId - 방장 ID
   */
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

      if (failedMemberIds.length > 0)
        throw new InternalServerErrorException(
          '일부 멤버 강퇴에 실패했습니다.',
        );

      const freshState = await this.timerRepository.getRoomStateRaw(roomCode);
      const fresh = extractUnsignedSummary(freshState);
      if (fresh.hostUnsigned || fresh.memberIds.length > 0) {
        throw new InternalServerErrorException(
          '일부 멤버 강퇴에 실패했습니다.',
        );
      }
    }
    return this.beginSession(roomCode, template, { kickedMemberIds });
  }

  /**
   * 중도포기(탈옥) 처리.
   * 벌칙 산정 → 자동공개 잡 등록(10분) → Redis 상태 업데이트 → 소켓 연결 해제 순으로 진행합니다.
   * 마지막 활성 멤버가 포기하면 세션을 자동 종료합니다.
   *
   * @param roomCode - 방 코드
   * @param userId - 포기하는 유저 ID
   * @returns { userId, gaveUpAt }
   * @throws ConflictException 이미 포기한 상태이거나 timer 페이즈가 아닌 경우
   */
  async giveUp(roomCode: string, userId: string) {
    const isGuest = userId.startsWith('guest_');
    const member = await this.timerRepository.findMemberForGiveUp(
      roomCode,
      userId,
      isGuest,
    );

    if (!member)
      throw new NotFoundException('방 참여 정보를 찾을 수 없습니다.');
    if (member.room.phase !== 'timer')
      throw new ConflictException('집중 진행 중에만 탈옥할 수 있습니다.');
    if (member.gaveUpAt) throw new ConflictException('이미 탈옥한 상태입니다.');

    const now = new Date();
    await this.timerRepository.giveUpTransaction(member.id, now);
    await this.safeCalculateForGiveUp(roomCode, member.id);

    await this.sessionQueue
      .add(
        'reveal-penalties',
        {
          kind: 'reveal-penalties',
          roomCode,
          memberId: member.id,
        },
        {
          jobId: revealJobId(roomCode, member.id),
          delay: ROULETTE_TIMEOUT_MS,
          removeOnComplete: true,
          removeOnFail: 100,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      )
      .catch(() => undefined);

    await this.timerRepository.saveGiveUpState(
      roomCode,
      userId,
      now.toISOString(),
    );

    const sockets = await this.roomGateway.server.in(roomCode).fetchSockets();
    const userSocket = sockets.find((s) => s.data.userId === userId);
    userSocket?.disconnect();

    const responseData = { userId, gaveUpAt: now };
    this.roomGateway.server.to(roomCode).emit('member:gave-up', responseData);

    const activeCount =
      await this.roomService.countActiveMembersInRoom(roomCode);
    if (activeCount === 0) {
      await this.endSession(roomCode);
    }
    return responseData;
  }

  /**
   * 특정 멤버의 미공개 벌칙을 전부 공개합니다.
   * BullMQ reveal-penalties 잡에서 호출되며, 이미 공개된 경우 0건을 반환합니다 (멱등).
   *
   * @param memberId - RoomMember ID
   * @returns { count } 공개된 벌칙 수
   */
  async revealPenalties(memberId: string): Promise<{ count: number }> {
    return this.timerRepository.revealUnrevealedPenalties(memberId);
  }

  /**
   * 세션 종료 후 모든 멤버에 대해 벌칙 자동공개 잡을 등록합니다.
   * 10분(ROULETTE_TIMEOUT_MS) 후 미공개 벌칙이 자동 공개됩니다.
   * 멤버가 룰렛을 완료하면 해당 잡은 0건 업데이트(no-op)로 처리됩니다.
   *
   * @param roomCode - 방 코드
   */
  private async scheduleRevealJobs(roomCode: string): Promise<void> {
    const memberIds = await this.timerRepository.findRoomMemberIds(roomCode);
    await Promise.all(
      memberIds.map((memberId) =>
        this.sessionQueue
          .add(
            'reveal-penalties',
            { kind: 'reveal-penalties', roomCode, memberId },
            {
              jobId: revealJobId(roomCode, memberId),
              delay: ROULETTE_TIMEOUT_MS,
              removeOnComplete: true,
              removeOnFail: 100,
              attempts: 3,
              backoff: { type: 'exponential', delay: 1000 },
            },
          )
          .catch(() => undefined),
      ),
    );
    this.logger.log(
      `[BullMQ] 벌칙 자동공개 잡 ${memberIds.length}건 등록 (room=${roomCode})`,
    );
  }

  /**
   * 세션을 종료합니다. DB 업데이트 → 벌칙 산정 → BullMQ 잡 정리 → reveal 잡 등록 순으로 처리합니다.
   *
   * @param roomCode - 방 코드
   */
  async endSession(roomCode: string): Promise<void> {
    const room = await this.timerRepository.findRoomPhase(roomCode);
    if (!room || room.phase === 'result' || room.phase === 'closed') return;

    const now = new Date();
    await this.timerRepository.updateRoomSessionEnd(roomCode, now);
    await this.roomService.updateRedisPhase(roomCode, 'result');
    try {
      await this.penaltyService.calculateAndSave(roomCode);
    } catch (err) {
      Sentry.captureException(err);
    }

    await this.cancelSessionJobs(roomCode);
    this.roomGateway.server
      .to(roomCode)
      .emit('session:ended', { endedAt: now });
    await this.scheduleRevealJobs(roomCode);
  }

  /**
   * 서버 재시작 시 진행 중인 방의 BullMQ 잡을 복구합니다.
   * end, break-warning, break-start 잡의 남은 지연 시간을 재계산하여 등록합니다.
   */
  async onModuleInit(): Promise<void> {
    const running = await this.timerRepository.findTimerRooms().catch(() => []);
    for (const room of running) {
      if (!room.template || !room.startedAt) continue;
      const totalMs = this.getSessionDurationMs(room.template);
      const remaining = totalMs - (Date.now() - room.startedAt.getTime());

      if (remaining <= 0) {
        await this.endSession(room.code).catch(() => undefined);
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

          const breakStartMs = (focusMin * r + breakMin * (r - 1)) * 60 * 1000;
          const breakStartTarget = room.startedAt.getTime() + breakStartMs;
          const breakStartDelay = breakStartTarget - Date.now();
          if (breakStartDelay > 0) {
            await this.sessionQueue
              .add(
                'break-start',
                { kind: 'break-start', roomCode: room.code, round: r },
                {
                  jobId: breakStartJobId(room.code, r),
                  delay: breakStartDelay,
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

  /**
   * 휴식 종료 1분 전 푸시 알림 + Socket.IO 이벤트를 전송합니다.
   *
   * @param roomCode - 방 코드
   */
  async sendBreakWarning(roomCode: string): Promise<void> {
    await this.pushService.sendToRoom(
      roomCode,
      '휴식이 1분 남았어요! ⏰',
      '곧 집중 시간이 시작됩니다. 자리에 앉아주세요!',
    );
    this.roomGateway.server.to(roomCode).emit('break:warning');
  }

  /**
   * Redis에서 미서명 멤버 정보를 로드합니다.
   * 방장이 미서명이면 즉시 예외를 던집니다.
   *
   * @param roomCode - 방 코드
   * @returns 미서명 멤버 요약 (hostUnsigned, memberIds)
   * @throws ConflictException 방 상태 조회 실패 시
   * @throws BadRequestException 방장이 미서명 시
   */
  private async loadSignState(roomCode: string): Promise<UnsignedSummary> {
    const rawState = await this.timerRepository.getRoomStateRaw(roomCode);
    if (!rawState) throw new ConflictException('방 상태를 확인할 수 없습니다.');
    const summary = extractUnsignedSummary(rawState);
    if (summary.hostUnsigned)
      throw new BadRequestException(
        '방장이 서명을 완료해야 시작할 수 있습니다.',
      );
    return summary;
  }

  /**
   * 방의 세션 템플릿을 로드합니다.
   *
   * @param roomCode - 방 코드
   * @returns 세션 템플릿 (focusMin, breakMin, rounds 등)
   * @throws NotFoundException 각서가 없을 때
   */
  private async loadRoomTemplate(roomCode: string) {
    const room = await this.timerRepository.findRoomWithTemplate(roomCode);
    if (!room?.template) throw new NotFoundException('각서가 없습니다.');
    return room.template;
  }

  /**
   * 세션을 실제로 시작합니다.
   * DB 페이즈 전환 → Redis 반영 → BullMQ 잡 스케줄링 → Y.Doc 정리 → 클라이언트 알림
   *
   * @param roomCode - 방 코드
   * @param template - 세션 템플릿
   * @param extra - 추가 데이터 (kickedMemberIds: 강제 시작 시 강퇴된 멤버 목록)
   * @returns 세션 시작 응답 데이터 (startedAt, focusMin, breakMin 등)
   */
  private async beginSession(
    roomCode: string,
    template: SessionTemplate,
    extra: { kickedMemberIds?: string[] } = {},
  ) {
    const now = new Date();
    try {
      await this.timerRepository.updateRoomSessionStart(roomCode, now);
    } catch {
      throw new InternalServerErrorException(
        '세션 시작 중 오류가 발생했습니다.',
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

  /**
   * 중도포기자의 벌칙을 산정합니다.
   * 실패해도 세션 흐름을 중단하지 않도록 에러를 Sentry로 보고하고 무시합니다.
   *
   * @param roomCode - 방 코드
   * @param memberId - RoomMember ID
   */
  private async safeCalculateForGiveUp(
    roomCode: string,
    memberId: string,
  ): Promise<void> {
    try {
      await this.penaltyService.calculateAndSaveForGiveUp(roomCode, memberId);
    } catch (err: unknown) {
      Sentry.captureException(err);
    }
  }

  /**
   * BullMQ 잡으로 등록할 세션 관련 잡을 스케줄링합니다.
   * end(세션 종료), break-warning(휴식 알림), break-start(이탈 통계)를 등록합니다.
   * break-warning과 break-start는 독립적으로 판단하여 등록합니다.
   *
   * @param roomCode - 방 코드
   * @param template - 세션 템플릿 (focusMin, breakMin, rounds)
   * @param totalDurationMs - 총 세션 시간 (밀리초)
   */
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
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    for (let r = 1; r < rounds; r++) {
      const notifyTimeMs = ((focusMin + breakMin) * r - 1) * 60 * 1000;
      if (notifyTimeMs > 0) {
        await this.sessionQueue.add(
          'break-warning',
          { kind: 'break-warning', roomCode, round: r },
          {
            jobId: warnJobId(roomCode, r),
            delay: notifyTimeMs,
            removeOnComplete: true,
            removeOnFail: 100,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          },
        );
      }
      const breakStartMs = (focusMin * r + breakMin * (r - 1)) * 60 * 1000;
      if (breakStartMs > 0) {
        await this.sessionQueue.add(
          'break-start',
          { kind: 'break-start', roomCode, round: r },
          {
            jobId: breakStartJobId(roomCode, r),
            delay: breakStartMs,
            removeOnComplete: true,
            removeOnFail: 100,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          },
        );
      }
    }
  }

  /**
   * 세션 잡(end, break-warning, break-start, reveal)을 일괄 취소합니다.
   * 방 삭제 또는 세션 종료 시 호출됩니다.
   *
   * @param roomCode - 방 코드
   */
  async cancelSessionJobs(roomCode: string): Promise<void> {
    const room = await this.timerRepository.findRoomRounds(roomCode);
    const rounds = room?.template?.rounds ?? MAX_ROUNDS_FALLBACK;
    const ids = [
      endJobId(roomCode),
      ...Array.from({ length: rounds }, (_, i) => warnJobId(roomCode, i + 1)),
      ...Array.from({ length: rounds - 1 }, (_, i) =>
        breakStartJobId(roomCode, i + 1),
      ),
    ];
    const memberIds = await this.timerRepository.findRoomMemberIds(roomCode);
    const revealIds = memberIds.map((id) => revealJobId(roomCode, id));
    await Promise.all(
      [...ids, ...revealIds].map((id) =>
        this.sessionQueue.remove(id).catch(() => undefined),
      ),
    );
  }

  /**
   * 방의 이탈 통계를 계산하여 Socket.IO로 브로드캐스트합니다.
   * break-start 잡에서 호출됩니다.
   *
   * @param roomCode - 방 코드
   */
  async emitEscapeSummary(roomCode: string): Promise<void> {
    const summary = await this.escapeService.getCurrentSummary(roomCode);
    this.roomGateway.server
      .to(roomCode)
      .emit('escape:summary', { members: summary });
  }

  /**
   * 'room.closed' 이벤트 핸들러.
   * 방이 삭제되면 해당 방의 모든 BullMQ 잡(end, break, reveal)을 취소합니다.
   *
   * @param payload - { roomCode: 삭제된 방 코드 }
   */
  @OnEvent('room.closed')
  async handleRoomClosed(payload: { roomCode: string }) {
    await this.cancelSessionJobs(payload.roomCode);
  }
}
