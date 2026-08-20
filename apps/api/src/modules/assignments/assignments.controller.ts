import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { ReasonDto } from '../tickets/tickets.dto';
import { CreateAssignmentDto, ReassignDto, UpdateMemberDto } from './assignments.dto';
import { AssignmentsService } from './assignments.service';

@ApiTags('Assignments')
@ApiBearerAuth()
@Controller()
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  @Post('tickets/:id/assignments') @Permissions('ticket.assign')
  create(@Param('id') id: string, @Body() dto: CreateAssignmentDto, @CurrentUser() user: AuthUser) { return this.service.create(id, dto, user); }

  @Get('tickets/:id/assignments') @Permissions('ticket.read.all', 'ticket.read.assigned')
  history(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.service.history(id, user); }

  @Post('assignments/:id/reassign') @Permissions('ticket.reassign')
  reassign(@Param('id') id: string, @Body() dto: ReassignDto, @CurrentUser() user: AuthUser) { return this.service.reassign(id, dto, user); }

  @Patch('assignments/:id/members/:memberId') @Permissions('ticket.assign')
  updateMember(@Param('id') id: string, @Param('memberId') memberId: string, @Body() dto: UpdateMemberDto, @CurrentUser() user: AuthUser) { return this.service.updateMember(id, memberId, dto, user); }

  @Post('assignments/:id/members/:memberId/remove') @Permissions('ticket.reassign')
  remove(@Param('id') id: string, @Param('memberId') memberId: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthUser) { return this.service.removeMember(id, memberId, dto.reason, user); }

  @Get('technician/assignments') @Permissions('ticket.read.assigned')
  mine(@CurrentUser() user: AuthUser) { return this.service.myAssignments(user); }

  @Post('technician/assignments/:memberId/accept') @Permissions('ticket.read.assigned')
  accept(@Param('memberId') memberId: string, @CurrentUser() user: AuthUser) { return this.service.accept(memberId, user); }
}
