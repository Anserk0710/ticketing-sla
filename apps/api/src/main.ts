import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import { randomUUID } from 'crypto';
import {
  mkdirSync,
} from 'fs';
import {
  resolve,
} from 'path';

import helmet from 'helmet';

import {
  NextFunction,
  Request,
  Response,
} from 'express';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const mediaStorageProvider = (
    process.env.MEDIA_STORAGE_PROVIDER ??
    'LOCAL'
  )
    .trim()
    .toUpperCase();

  /*
   * Hanya membuat folder upload untuk local/Docker.
   *
   * Vercel Blob tidak membutuhkan filesystem
   * persistent pada Vercel Function.
   *
   * Vercel memiliki filesystem read-only di /var/task,
   * sehingga mkdirSync akan gagal. Skip jika berjalan di Vercel.
   */
  if (
    mediaStorageProvider === 'LOCAL' &&
    !process.env.VERCEL
  ) {
    const uploadDir =
      process.env.UPLOAD_DIR ??
      resolve(
        process.cwd(),
        'uploads',
      );

    mkdirSync(
      uploadDir,
      {
        recursive: true,
      },
    );
  }

  const app =
    await NestFactory.create(
      AppModule,
      {
        cors: false,
      },
    );

  app.use(
    helmet({
      crossOriginResourcePolicy: {
        policy: 'cross-origin',
      },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://cdnjs.cloudflare.com',
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://cdnjs.cloudflare.com',
          ],
          imgSrc: [
            "'self'",
            'data:',
            'https://validator.swagger.io',
          ],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
        },
      },
    }),
  );

  const allowedOrigins = (
    process.env.PUBLIC_WEB_URL ??
    'http://localhost:5173'
  )
    .split(',')
    .map(
      (origin) =>
        origin.trim(),
    )
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.use(
    (
      request: Request & {
        requestId?: string;
      },
      response: Response,
      next: NextFunction,
    ) => {
      request.requestId =
        request.header(
          'x-request-id',
        ) ??
        randomUUID();

      response.setHeader(
        'x-request-id',
        request.requestId,
      );

      next();
    },
  );

  app.setGlobalPrefix(
    'api/v1',
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(
    new ResponseInterceptor(),
  );

  app.useGlobalFilters(
    new HttpExceptionFilter(),
  );

  const swagger =
    new DocumentBuilder()
      .setTitle(
        'Ticketing SLA API',
      )
      .setDescription(
        'REST API Ticketing, Field Service, SLA Respond dan SLA Pengerjaan',
      )
      .setVersion(
        '1.0.0',
      )
      .addBearerAuth()
      .build();

  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(
      app,
      swagger,
    ),
    {
      customCssUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css',
      customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-standalone-preset.min.js',
      ],
    },
  );

  const port =
    Number(
      process.env.PORT ??
      3000,
    );

  await app.listen(
    port,
    '0.0.0.0',
  );

  console.info(
    `API berjalan di http://localhost:${port}/api/v1`,
  );

  console.info(
    `Swagger tersedia di http://localhost:${port}/docs`,
  );
}

bootstrap();