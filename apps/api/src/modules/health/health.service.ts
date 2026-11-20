import {
    Injectable,
    ServiceUnavailableException,
} from '@nestjs/common';

import {
    ConfigService,
} from '@nestjs/config';

import {
    PrismaService,
} from '../../database/prisma.service';

@Injectable()
export class HealthService {
    constructor(
        private readonly prisma:
            PrismaService,

        private readonly config:
            ConfigService,
    ) { }

    live() {
        return {
            status:
                'live',

            checkedAt:
                new Date()
                    .toISOString(),

            uptimeSeconds:
                Math.floor(
                    process.uptime(),
                ),

            version:
                process.env
                    .npm_package_version ??
                'unknown',

            commit:
                process.env
                    .VERCEL_GIT_COMMIT_SHA
                    ?.slice(
                        0,
                        12,
                    ) ??
                null,
        };
    }

    async ready() {
        const startedAt =
            performance.now();

        try {
            /*
             * Query yang sangat ringan.
             *
             * Ready berarti API dapat benar-benar
             * berkomunikasi dengan PostgreSQL,
             * bukan sekadar process hidup.
             */
            await this.prisma
                .$queryRaw`
          SELECT 1
        `;
        } catch {
            throw new ServiceUnavailableException({
                code:
                    'DATABASE_NOT_READY',

                message:
                    'Database belum siap.',
            });
        }

        const databaseLatencyMs =
            performance.now() -
            startedAt;

        return {
            status:
                'ready',

            checkedAt:
                new Date()
                    .toISOString(),

            database: {
                status:
                    'up',

                latencyMs:
                    Number(
                        databaseLatencyMs
                            .toFixed(
                                2,
                            ),
                    ),
            },

            runtime: {
                environment:
                    this.config.get<string>(
                        'APP_ENV',
                    ) ??
                    'DEVELOPMENT',

                mediaStorage:
                    this.config.get<string>(
                        'MEDIA_STORAGE_PROVIDER',
                    ) ??
                    'LOCAL',

                slaScheduler:
                    this.config.get<string>(
                        'SLA_SCHEDULER_MODE',
                    ) ??
                    'INTERNAL',
            },

            deployment: {
                commit:
                    process.env
                        .VERCEL_GIT_COMMIT_SHA
                        ?.slice(
                            0,
                            12,
                        ) ??
                    null,

                environment:
                    process.env
                        .VERCEL_ENV ??
                    null,

                region:
                    process.env
                        .VERCEL_REGION ??
                    null,
            },
        };
    }
}