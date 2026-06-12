import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { ConfigService } from '@nestjs/config';
import type { PushSubscription } from 'web-push';
import { TimerRepository } from './timer.repository';
import { RedisService } from '../../common/redis/redis.service';
import { OnEvent } from '@nestjs/event-emitter';
import { SnsService } from '../sns/sns.service';

const PUSH_SUB_TTL_SEC = 11 * 60 * 60;
const PUSH_COOLDOWN_SEC = 10;

interface WebPushError {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  message?: string;
}

function isWebPushError(err: unknown): err is WebPushError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    typeof (err as Record<string, unknown>).statusCode === 'number'
  );
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private pushEnabled = false;

  constructor(
    private readonly timerRepository: TimerRepository,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly snsService: SnsService,
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

  async saveSubscription(
    roomCode: string,
    userId: string,
    data: string | PushSubscription,
    platform: string,
  ): Promise<void> {
    this.logger.log(
      `[Push] 구독 저장 (room=${roomCode}, user=${userId}, platform=${platform})`,
    );

    let endpointArn: string | null = null;
    if (platform === 'android' && typeof data === 'string') {
      endpointArn = await this.snsService.registerAndroidEndpoint(data);
    }

    const payload = JSON.stringify({
      platform,
      data: platform === 'android' ? endpointArn : data,
    });

    await this.timerRepository.savePushSubscription(
      roomCode,
      userId,
      payload,
      PUSH_SUB_TTL_SEC,
    );
  }

  async sendToRoom(
    roomCode: string,
    title: string,
    body: string,
  ): Promise<void> {
    if (!this.pushEnabled) return;

    const raw = await this.timerRepository.getRoomStateRaw(roomCode);
    if (!raw) return;

    const state = JSON.parse(raw) as { members?: Record<string, unknown> };
    if (!state.members) return;

    const userIds = Object.keys(state.members);
    const payload = JSON.stringify({ title, body });

    await Promise.all(
      userIds.map(async (userId) => {
        const subRaw = await this.timerRepository.getPushSubscription(
          roomCode,
          userId,
        );
        this.logger.log(`[Push] 구독 조회 (user=${userId}, found=${!!subRaw})`);
        if (!subRaw) return;

        const parsed = JSON.parse(subRaw) as {
          platform: string;
          data: string | PushSubscription;
        };
        
        if (parsed.platform === 'android') {
          await this.snsService.sendPushNotification(parsed.data as string, title, body).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`푸시 전송 실패 (${userId}): ${msg}`);
          });
        } else {
          await webpush.sendNotification(parsed.data as PushSubscription, payload).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`푸시 전송 실패 (${userId}): ${msg}`);
          });
        }
      }),
    );
  }

  async sendToUser(
    roomCode: string,
    userId: string,
    title: string,
    body: string,
  ): Promise<void> {
    if (!this.pushEnabled) return;

    const cooldownKey = `push_cooldown:${roomCode}:${userId}`;
    const isCooldown = await this.redisService.instance.get(cooldownKey);
    if (isCooldown) {
      this.logger.log(`[Push] 쿨타임 적용 중 - 알림 생략 (user=${userId})`);
      return;
    }

    const subRaw = await this.timerRepository.getPushSubscription(
      roomCode,
      userId,
    );
    this.logger.log(
      `[Push] 개별 구독 조회 (user=${userId}, found=${!!subRaw})`,
    );
    if (!subRaw) return;

    try {
      const parsed = JSON.parse(subRaw) as {
        platform: string;
        data: string | PushSubscription;
      };
      const payload = JSON.stringify({ title, body });

      if (parsed.platform === 'android') {
        await this.snsService.sendPushNotification(parsed.data as string, title, body);
      } else {
        await webpush.sendNotification(parsed.data as PushSubscription, payload);
      }

      await this.redisService.instance.set(
        cooldownKey,
        '1',
        'EX',
        PUSH_COOLDOWN_SEC,
      );
    } catch (err: unknown) {
      if (isWebPushError(err)) {
        this.logger.warn(
          `개별 푸시 전송 실패 (${userId}) [Status: ${err.statusCode}]: ${err.body}`,
        );
        if (err.statusCode === 404 || err.statusCode === 410) {
          await this.redisService.instance.del(
            `push_sub:${roomCode}:${userId}`,
          );
        }
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`개별 푸시 전송 실패 (${userId}): ${msg}`);
      }
    }
  }
  @OnEvent('escape.started')
  async handleEscapeStarted(payload: { roomCode: string; userId: string }) {
    await this.sendToUser(
      payload.roomCode,
      payload.userId,
      '🚨 화면 이탈 감지!',
      '집중 화면을 벗어났습니다. 이탈 시간이 누적되고 있어요!',
    ).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`이탈 푸시 에러: ${msg}`);
    });
  }
}
