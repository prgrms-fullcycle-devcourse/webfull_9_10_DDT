import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SNSClient,
  CreatePlatformEndpointCommand,
  PublishCommand,
} from '@aws-sdk/client-sns';

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

  // 안드로이드 FCM 토큰을 AWS SNS Endpoint로 등록하고 ARN을 반환합니다.
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

  // 생성된 Endpoint ARN으로 메시지를 발송합니다.
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
