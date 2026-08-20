import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PrismaService } from '../../database/prisma.service';
import { SlaService } from './sla.service';

@ApiTags('SLA')
@ApiBearerAuth()
@Controller()
export class SlaController {
  constructor(private readonly prisma: PrismaService, private readonly sla: SlaService) {}

  @Get('tickets/:id/sla')
  @Permissions('ticket.read.all', 'ticket.read.assigned')
  async ticketSla(@Param('id') id: string) {
    const items = await this.prisma.slaInstance.findMany({ where: { OR: [{ ticketId: id }, { assignmentMember: { assignment: { ticketId: id } } }] }, orderBy: { startedAt: 'asc' } });
    return items.map((item) => this.sla.present(item));
  }

  @Get('assignments/:memberId/sla')
  @Permissions('ticket.read.all', 'ticket.read.assigned')
  async memberSla(@Param('memberId') memberId: string) {
    const item = await this.prisma.slaInstance.findFirstOrThrow({ where: { assignmentMemberId: memberId } });
    return this.sla.present(item);
  }

  @Get('sla/policies')
  @Permissions('sla.policy.read')
  listPolicies() {
    return this.prisma.slaPolicyVersion.findMany({ include: { priority: true, createdBy: { select: { displayName: true } } }, orderBy: [{ priority: { severityOrder: 'asc' } }, { version: 'desc' }] });
  }

  @Get('sla/breaches')
  @Permissions('report.read')
  breaches() {
    return this.prisma.slaInstance.findMany({ where: { status: 'BREACHED' }, include: { ticket: true, assignmentMember: { include: { technician: true, assignment: { include: { ticket: true } } } } }, orderBy: { dueAt: 'asc' } });
  }
}
