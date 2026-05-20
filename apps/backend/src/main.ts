import './instrument';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origin.includes('localhost') || origin.includes('vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, 
  });

  const config = new DocumentBuilder()
    .setTitle('DDT API 명세서')
    .setDescription('DDT 프로젝트의 백엔드 API 문서입니다.')
    .setVersion('1.0') 
    .addBearerAuth() 
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 8080;
  await app.listen(port);
  
  Logger.log(`백엔드 주소 : http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Swagger 문서 : http://localhost:${port}/api/docs`, 'Bootstrap');
}
void bootstrap();