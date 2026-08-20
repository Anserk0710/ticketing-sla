import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { MediaModule } from '../media/media.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
    imports: [
        EmailModule,
        MediaModule,
    ],

    controllers: [
        TicketsController,
    ],

    providers: [
        TicketsService,
    ],

    exports: [
        TicketsService,
    ],
})
export class TicketsModule { }