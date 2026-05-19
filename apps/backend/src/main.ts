import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: [
      'http://localhost:3000', 
      'https://webfull-9-10-ddt-frontend.vercel.app', 
    ],
    credentials: true, 
  });

  const port = process.env.PORT || 8080;
  
  await app.listen(port);
  
  Logger.log(`백엔드 주소 : http://localhost:${port}`, 'Bootstrap');
}
void bootstrap();
