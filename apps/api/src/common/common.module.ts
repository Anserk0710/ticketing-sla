import {
    Global,
    Module,
} from '@nestjs/common';

import {
    BackgroundTaskService,
} from './services/background-task.service';

@Global()
@Module({
    providers: [
        BackgroundTaskService,
    ],

    exports: [
        BackgroundTaskService,
    ],
})
export class CommonModule { }