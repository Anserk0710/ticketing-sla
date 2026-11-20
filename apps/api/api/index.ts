import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import helmet from 'helmet';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

const server = express();

let app: any;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
      cors: false,
    });

    app.use(
      helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
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

    const allowedOrigins = (process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    app.enableCors({ origin: allowedOrigins, credentials: true });

    app.use(
      (
        request: Request & { requestId?: string },
        response: Response,
        next: NextFunction,
      ) => {
        request.requestId =
          request.header('x-request-id') ?? randomUUID();
        response.setHeader('x-request-id', request.requestId);
        next();
      },
    );

    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    const swagger = new DocumentBuilder()
      .setTitle('Ticketing SLA API')
      .setDescription(
        'REST API Ticketing, Field Service, SLA Respond dan SLA Pengerjaan',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, swagger),
      {
        customCssUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css',
        customJs: [
          'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-standalone-preset.min.js',
        ],
      },
    );

    await app.init();
  }
  return server;
}

export default async function handler(req: any, res: any) {
  const expressApp = await bootstrap();
  expressApp(req, res);
}
