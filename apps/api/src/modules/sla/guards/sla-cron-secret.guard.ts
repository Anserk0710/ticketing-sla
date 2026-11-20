import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "crypto";
import { Request } from "express";

@Injectable()
export class SlaCronSecretGuard
    implements CanActivate {
    constructor(
        private readonly config:
            ConfigService,
    ) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context
            .switchToHttp()
            .getRequest<Request>();

        const configuredSecret =
            this.config
                .get<string>('SLA_CRON_SECRET',)
                ?.trim();

        if (!configuredSecret) {
            throw new UnauthorizedException({
                code: 'SLA_CRON_SECRET_NOT_CONFIGURED',
                message: 'Secret Scheduler SLA belum dikonfigurasi.',
            });
        }

        const authorization = request.header('authorization') ?? '';
        const prefix = 'Bearer';
        if (!authorization.startsWith(
            prefix,
        )) {
            throw new UnauthorizedException({
                code: 'SLA_CRON_UNAUTHORIZED',
                message: 'Credential scheduler SLA tidak valid.',
            });
        }

        const receivedSecret =
            authorization
                .slice(prefix.length)
                .trim();
        const expected =
            Buffer.from(configuredSecret, 'utf-8');
        const received =
            Buffer.from(receivedSecret, 'utf-8');
        if (expected.length !== received.length || !timingSafeEqual(
            expected,
            received,
        )) {
            throw new UnauthorizedException({
                code: 'SLA_CRON_UNAUTHORIZED',
                message: 'Credential scheduler SLA tidak valid.',
            });
        }

        return true;
    }
}