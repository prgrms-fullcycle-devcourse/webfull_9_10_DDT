import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('sentry-test')
  testSentry() {
    throw new Error('🔥 백엔드 Sentry 연동 테스트 에러입니다!');
  }
}
