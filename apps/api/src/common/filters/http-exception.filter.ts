import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId ?? randomUUID();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Terjadi kesalahan pada server.';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') message = body;
      else if (body && typeof body === 'object') {
        const payload = body as Record<string, unknown>;
        code = typeof payload.code === 'string' ? payload.code : this.codeFor(status);
        message = typeof payload.message === 'string' ? payload.message : Array.isArray(payload.message) ? 'Input tidak valid.' : exception.message;
        details = Array.isArray(payload.message) ? payload.message : payload.details;
      }
    } else {
      console.error(exception);
    }

    response.status(status).json({ error: { code, message, details, requestId } });
  }

  private codeFor(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND',
      409: 'CONFLICT', 422: 'UNPROCESSABLE_ENTITY', 429: 'RATE_LIMITED'
    };
    return map[status] ?? 'HTTP_ERROR';
  }
}
