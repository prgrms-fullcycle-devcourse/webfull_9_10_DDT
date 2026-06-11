import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { ConfigService } from '@nestjs/config';
import type { PushSubscription } from 'web-push';
import { TimerRepository } from './timer.repository';

const PUSH_SUB_TTL_SEC = 11 * 60 * 60;

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private pushEnabled = false;

  constructor(
    private readonly timerRepository: TimerRepository,
    private readonly configService: ConfigService,
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
    subscription: PushSubscription,
  ): Promise<void> {
    this.logger.log(`[Push] 구독 저장 (room=${roomCode}, user=${userId})`);
    await this.timerRepository.savePushSubscription(
      roomCode,
      userId,
      JSON.stringify(subscription),
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

  async sendToUser(
    roomCode: string,
    userId: string,
    title: string,
    body: string,
  ): Promise<void> {
    if (!this.pushEnabled) return;

    const subRaw = await this.timerRepository.getPushSubscription(
      roomCode,
      userId,
    );
    this.logger.log(`[Push] 개별 구독 조회 (user=${userId}, found=${!!subRaw})`);
    if (!subRaw) return;

    try {
      const subscription = JSON.parse(subRaw) as PushSubscription;
      const payload = JSON.stringify({ title, body });
      await webpush.sendNotification(subscription, payload);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`개별 푸시 전송 실패 (${userId}): ${msg}`);
    }
  }
}
