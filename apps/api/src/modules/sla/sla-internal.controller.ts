import {
    Controller,
    Post,
    UseGuards,
} from '@nestjs/common';

import {
    ApiExcludeController,
} from '@nestjs/swagger';

import {
    Public,
} from '../../common/decorators/public.decorator';

import {
    SlaCronSecretGuard,
} from './guards/sla-cron-secret.guard';

import {
    SlaService,
} from './sla.service';

@ApiExcludeController()
@Controller('internal/sla')
export class SlaInternalController {
    constructor(
        private readonly sla:
            SlaService,
    ) { }

    @Public()
    @Post('evaluate')
    @UseGuards(
        SlaCronSecretGuard,
    )
    async evaluate() {
        const startedAt =
            performance.now();

        const result =
            await this.sla
                .evaluateOpenInstances();

        const durationMs =
            performance.now() -
            startedAt;

        /*
         * Satu JSON line memudahkan pencarian
         * dari Vercel Runtime Logs.
         */
        console.info(
            JSON.stringify({
                event:
                    'sla.scheduler.evaluation',

                processed:
                    result.processed,

                updated:
                    result.updated,

                warning:
                    result.warning,

                breached:
                    result.breached,

                durationMs:
                    Number(
                        durationMs
                            .toFixed(
                                2,
                            ),
                    ),

                timestamp:
                    new Date()
                        .toISOString(),
            }),
        );

        return result;
    }
}