import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';

import {
    ConfigService,
} from '@nestjs/config';

import type {
    SlaSchedulerMode,
} from '../../config/environment';

import {
    SlaService,
} from './sla.service';

@Injectable()
export class SlaSchedulerService
    implements
    OnModuleInit,
    OnModuleDestroy {
    private readonly logger =
        new Logger(
            SlaSchedulerService.name,
        );

    private timer?:
        NodeJS.Timeout;

    private running = false;

    constructor(
        private readonly config:
            ConfigService,

        private readonly sla:
            SlaService,
    ) { }

    onModuleInit(): void {
        const mode =
            this.schedulerMode();

        /*
         * Vercel production.
         *
         * Tidak membuat timer sama sekali.
         */
        if (mode !== 'INTERNAL') {
            this.logger.log(
                'SLA scheduler internal nonaktif; menggunakan mode EXTERNAL.',
            );

            return;
        }

        const intervalMs =
            this.internalIntervalMs();

        this.logger.log(
            `SLA scheduler internal aktif setiap ${intervalMs / 1000} detik.`,
        );

        this.timer =
            setInterval(
                () => {
                    void this.runEvaluation();
                },
                intervalMs,
            );

        /*
         * Timer tidak boleh menjadi satu-satunya alasan
         * Node process tetap hidup.
         */
        this.timer.unref();
    }

    onModuleDestroy(): void {
        if (!this.timer) {
            return;
        }

        clearInterval(
            this.timer,
        );

        this.timer =
            undefined;
    }

    private async runEvaluation():
        Promise<void> {
        /*
         * Mencegah overlap pada process Docker
         * yang sama apabila evaluator lebih lama
         * dari interval scheduler.
         */
        if (this.running) {
            this.logger.warn(
                'Evaluasi SLA sebelumnya masih berjalan; tick dilewati.',
            );

            return;
        }

        this.running = true;

        try {
            const summary =
                await this.sla
                    .evaluateOpenInstances();

            if (
                summary.updated >
                0
            ) {
                this.logger.log(
                    `Evaluasi SLA selesai: ${summary.processed} diperiksa, ` +
                    `${summary.updated} diperbarui, ` +
                    `${summary.warning} warning, ` +
                    `${summary.breached} breached.`,
                );
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            this.logger.error(
                `Evaluasi SLA internal gagal: ${message}`,
            );
        } finally {
            this.running =
                false;
        }
    }

    private schedulerMode():
        SlaSchedulerMode {
        const raw =
            this.config
                .get<string>(
                    'SLA_SCHEDULER_MODE',
                )
                ?.trim()
                .toUpperCase();

        return raw === 'EXTERNAL'
            ? 'EXTERNAL'
            : 'INTERNAL';
    }

    private internalIntervalMs():
        number {
        const raw =
            Number(
                this.config.get(
                    'SLA_INTERNAL_INTERVAL_MS',
                ) ?? 60_000,
            );

        if (
            !Number.isFinite(raw) ||
            raw < 10_000
        ) {
            return 60_000;
        }

        return Math.floor(raw);
    }
}