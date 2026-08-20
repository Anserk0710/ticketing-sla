import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { CheckinDto, CompleteWorkDto, StartWorkDto } from './field-operations.dto';
import { FieldOperationsService } from './field-operations.service';

@ApiTags('Field Operations')
@ApiBearerAuth()
@Controller('technician/assignments/:memberId')
export class FieldOperationsController {
  constructor(private readonly service: FieldOperationsService) {}
  @Post('checkins') @Permissions('field.checkin') checkin(@Param('memberId') id: string, @Body() dto: CheckinDto, @CurrentUser() user: AuthUser) { return this.service.checkin(id, dto, user); }
  @Post('start') @Permissions('field.work.start') start(@Param('memberId') id: string, @Body() dto: StartWorkDto, @CurrentUser() user: AuthUser) { return this.service.start(id, dto, user); }
  @Post('complete') @Permissions('field.work.complete') complete(@Param('memberId') id: string, @Body() dto: CompleteWorkDto, @CurrentUser() user: AuthUser) { return this.service.complete(id, dto, user); }
  @Get('activity') @Permissions('ticket.read.assigned', 'ticket.read.all') activity(@Param('memberId') id: string, @CurrentUser() user: AuthUser) { return this.service.activity(id, user); }
}
