import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const uploadDir = process.env.UPLOAD_DIR ?? resolve(process.cwd(), 'uploads');
  mkdirSync(uploadDir, { recursive: true });
  const app = await NestFactory.create(AppModule, { cors: false });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: process.env.PUBLIC_WEB_URL?.split(',') ?? ['http://localhost:5173'], credentials: true });
  app.use((request: Request & { requestId?: string }, response: Response, next: NextFunction) => {
    request.requestId = request.header('x-request-id') ?? randomUUID();
    response.setHeader('x-request-id', request.requestId);
    next();
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  const swagger = new DocumentBuilder()
    .setTitle('Ticketing SLA API').setDescription('REST API Ticketing, Field Service, SLA Respond dan SLA Pengerjaan')
    .setVersion('1.0.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.info(`API berjalan di http://localhost:${port}/api/v1`);
  console.info(`Swagger tersedia di http://localhost:${port}/docs`);
}
bootstrap();
