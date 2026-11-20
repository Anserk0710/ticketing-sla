import {
    Global,
    Module,
} from '@nestjs/common';

import {
    SlaCronSecretGuard,
} from './guards/sla-cron-secret.guard';

import {
    SlaController,
} from './sla.controller';

import {
    SlaInternalController,
} from './sla-internal.controller';

import {
    SlaSchedulerService,
} from './sla-scheduler.service';

import {
    SlaService,
} from './sla.service';

@Global()
@Module({
    providers: [
        SlaService,
        SlaSchedulerService,
        SlaCronSecretGuard,
    ],

    controllers: [
        SlaController,
        SlaInternalController,
    ],

    exports: [
        SlaService,
    ],
})
export class SlaModule { }