import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable, catchError, tap, throwError } from "rxjs";

type AuthenticatedRequest =
    Request & {
        requestId?: string;

        user?: {
            id?: string;
        };
    };

type HttpLogRecord = {
    event: 'http.request';
    requestId: string | null;
    vercelRequestId:
    string | null;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    actorId: string | null;
    slow: boolean;
    error?: {
        name: string;
        message: string;
    };
};

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
    constructor(
        private readonly slowRequestThresholdMs = 1500,
    ) { }
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        if (context.getType() !== 'http') {
            return next.handle();
        }
        const request =
            context
                .switchToHttp()
                .getRequest<AuthenticatedRequest>();
        const response =
            context
                .switchToHttp()
                .getResponse<Response>();
        const startedAt = process.hrtime.bigint();
        const writeLog = (
            error?: unknown,
        ): void => {
            const endedAt = process.hrtime.bigint();
            const durationMs = Number(endedAt - startedAt) / 1_000_000;
            const statusCode = error instanceof HttpException
                ? error.getStatus()
                : error
                    ? 500
                    : response.statusCode;
            const successfulHealthCheck =
                statusCode < 400 &&
                (
                    request.path === '/api/v1/health/live' ||
                    request.path === '/api/v1/health/ready'
                );

            if (successfulHealthCheck) {
                return;
            }

            const slow =
                durationMs >=
                this.slowRequestThresholdMs;

            const record:
                HttpLogRecord = {
                event:
                    'http.request',

                requestId:
                    request.requestId ??
                    null,

                vercelRequestId:
                    request.header(
                        'x-vercel-id',
                    ) ??
                    null,

                method:
                    request.method,

                path:
                    request.path,

                statusCode,

                durationMs:
                    Number(
                        durationMs.toFixed(2)
                    ),

                actorId:
                    request.user?.id ??
                    null,

                slow,
            };

            if (
                error &&
                statusCode >= 500
            ) {
                record.error = {
                    name:
                        error instanceof Error
                            ? error.name
                            : 'UnknownError',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown internal error',
                };
            }

            const serialized =
                JSON.stringify(
                    record,
                );
            if (
                statusCode >= 500
            ) {
                console.error(
                    serialized,
                );

                return;
            }
            if (
                statusCode >= 400 ||
                slow
            ) {
                console.warn(
                    serialized,
                );

                return;
            }

            console.info(
                serialized,
            );
        };

        return next
            .handle()
            .pipe(
                tap(
                    () => {
                        writeLog();
                    },
                ),

                catchError(
                    (error) => {
                        writeLog(
                            error,
                        );

                        return throwError(
                            () =>
                                error,
                        );
                    },
                ),
            );
    }
}