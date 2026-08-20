import { Global, Module } from '@nestjs/common';
import { SlaService } from './sla.service';
import { SlaController } from './sla.controller';

@Global()
@Module({ providers: [SlaService], controllers: [SlaController], exports: [SlaService] })
export class SlaModule {}
