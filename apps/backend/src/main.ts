import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = 8080;
  
  await app.listen(process.env.PORT || 8080);
  
  Logger.log(`백엔드 주소 : http://localhost:${port}`, 'Bootstrap');
}
void bootstrap();
