import {
    Injectable,
    Logger,
} from '@nestjs/common';

import {
    waitUntil,
} from '@vercel/functions';

@Injectable()
export class BackgroundTaskService {
    private readonly logger =
        new Logger(
            BackgroundTaskService.name,
        );

    run(
        label: string,
        task: Promise<unknown>,
    ): void {
        const trackedTask =
            task.catch(
                (error: unknown) => {
                    const message =
                        error instanceof Error
                            ? error.message
                            : String(error);

                    this.logger.error(
                        `${label} failed: ${message}`,
                    );
                },
            );

        /*
         * Pada Vercel:
         *
         * waitUntil() menjaga invocation tetap hidup
         * sampai secondary/background operation selesai.
         *
         * Tanpa ini, Vercel dapat suspend function
         * setelah HTTP response dikirim.
         */
        if (
            process.env.VERCEL ===
            '1'
        ) {
            waitUntil(
                trackedTask,
            );

            return;
        }

        /*
         * Docker/local merupakan long-running
         * Node process sehingga background promise
         * dapat berjalan secara normal.
         */
        void trackedTask;
    }
}