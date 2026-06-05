import './instrument';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { CustomOrigin } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RedisIoAdapter } from './common/adapters/redis.adapter';
import { YjsGateway } from './modules/gateway/yjs/yjs.gateway';
import { Server } from 'http';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

const corsOrigin: CustomOrigin = (origin, callback) => {
  const allowedOrigins = [
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean);
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error('Not allowed by CORS'));
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());

  app.useGlobalFilters(new HttpExceptionFilter());

  const redisUrl = configService.get<string>(
    'REDIS_URL',
    'redis://localhost:6379',
  );
  const redisIoAdapter = new RedisIoAdapter(app, redisUrl);
  redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const httpServer = app.getHttpServer() as Server;

  const yjsGateway = app.get(YjsGateway);
  yjsGateway.init(httpServer);

  const config = new DocumentBuilder()
    .setTitle('DDT API 명세서')
    .setDescription('DDT 프로젝트의 백엔드 API 문서입니다.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(configService.get<string>('PORT') ?? 8080);
  await app.listen(port);

  Logger.log(`백엔드 주소 : http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Swagger 문서 : http://localhost:${port}/api/docs`, 'Bootstrap');
}
void bootstrap();
