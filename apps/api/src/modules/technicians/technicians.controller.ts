import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { ApprovalDecisionDto, RegisterTechnicianDto, RejectTechnicianDto } from './technicians.dto';
import { TechniciansService } from './technicians.service';

@ApiTags('Technicians')
@Controller()
export class TechniciansController {
  constructor(private readonly service: TechniciansService) {}

  @Public() @Post('public/technicians/register')
  register(@Body() dto: RegisterTechnicianDto) { return this.service.register(dto); }

  @ApiBearerAuth() @Get('technicians/approvals') @Permissions('technician.approve')
  approvals() { return this.service.listApprovals(); }

  @ApiBearerAuth() @Get('technicians/approvals/:id') @Permissions('technician.approve')
  detail(@Param('id') id: string) { return this.service.detail(id); }

  @ApiBearerAuth() @Post('technicians/approvals/:id/approve') @Permissions('technician.approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: ApprovalDecisionDto) { return this.service.approve(id, user.id, dto.note); }

  @ApiBearerAuth() @Post('technicians/approvals/:id/reject') @Permissions('technician.approve')
  reject(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: RejectTechnicianDto) { return this.service.reject(id, user.id, dto.reason); }

  @ApiBearerAuth() @Post('technicians/:id/suspend') @Permissions('user.manage')
  suspend(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: ApprovalDecisionDto) { return this.service.suspend(id, user.id, dto.note); }

  @ApiBearerAuth() @Post('technicians/:id/reactivate') @Permissions('user.manage')
  reactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.service.reactivate(id, user.id); }

  @ApiBearerAuth() @Get('technicians') @Permissions('ticket.assign', 'user.read')
  available() { return this.service.listAvailable(); }
}
