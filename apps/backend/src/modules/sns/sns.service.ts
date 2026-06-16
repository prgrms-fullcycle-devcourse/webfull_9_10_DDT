import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SNSClient,
  CreatePlatformEndpointCommand,
  PublishCommand,
} from '@aws-sdk/client-sns';

/**
 * AWS SNS를 통한 Android(FCM) 푸시 알림 서비스.
 * FCM 토큰을 SNS Platform Endpoint로 등록하고, 해당 Endpoint로 메시지를 발송합니다.
 */
@Injectable()
export class SnsService {
  private readonly snsClient: SNSClient;
  private readonly logger = new Logger(SnsService.name);

  constructor(private readonly configService: ConfigService) {
    this.snsClient = new SNSClient({
      region: this.configService.get<string>('AWS_REGION') || 'ap-northeast-2',
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey:
          this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
  }

  /**
   * Android FCM 토큰을 AWS SNS Platform Endpoint로 등록합니다.
   * 이미 등록된 토큰이면 기존 Endpoint ARN을 반환합니다.
   *
   * @param token - Android 디바이스의 FCM 등록 토큰
   * @returns 생성된 Endpoint ARN 또는 null (실패 시)
   */
  async registerAndroidEndpoint(token: string): Promise<string | null> {
    try {
      const command = new CreatePlatformEndpointCommand({
        PlatformApplicationArn: this.configService.getOrThrow<string>(
          'AWS_SNS_ANDROID_APP_ARN',
        ),
        Token: token,
      });
      const response = await this.snsClient.send(command);
      return response.EndpointArn ?? null;
    } catch (error) {
      this.logger.error('SNS Android Endpoint 생성 실패', error);
      return null;
    }
  }

  /**
   * SNS Endpoint ARN으로 FCM 푸시 메시지를 발송합니다.
   * GCM(FCM) JSON 구조로 페이로드를 구성합니다.
   *
   * @param targetArn - 대상 SNS Endpoint ARN
   * @param title - 알림 제목
   * @param body - 알림 본문
   * @throws 전송 실패 시 원본 에러를 rethrow
   */
  async sendPushNotification(
    targetArn: string,
    title: string,
    body: string,
  ): Promise<void> {
    // FCM 용 JSON 구조 페이로드
    const snsPayload = JSON.stringify({
      default: body,
      GCM: JSON.stringify({
        notification: { title, body, sound: 'default' },
      }),
    });

    try {
      const command = new PublishCommand({
        TargetArn: targetArn,
        Message: snsPayload,
        MessageStructure: 'json',
      });
      await this.snsClient.send(command);
    } catch (error) {
      this.logger.error(`SNS 푸시 전송 실패 (Target: ${targetArn})`, error);
      throw error;
    }
  }
}
