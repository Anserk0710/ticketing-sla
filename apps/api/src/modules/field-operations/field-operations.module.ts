import { Module } from '@nestjs/common';
import { FieldOperationsController } from './field-operations.controller';
import { FieldOperationsService } from './field-operations.service';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [MediaModule],
  controllers: [FieldOperationsController],
  providers: [FieldOperationsService],
})
export class FieldOperationsModule {}
