import { Injectable } from '@nestjs/common';
import { Prisma, SlaOutcome, SlaStatus, SlaType, TicketStatus } from '@prisma/client';
import ExcelJS from 'exceljs';
import { AuthUser } from '../../common/types/auth-user';
import { sanitizeExcelCell } from '../../common/utils/excel';
import { evaluateSla } from '../../common/utils/sla';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReportQueryDto } from './reports.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) { }

  async tickets(query: ReportQueryDto, paginate = true) {
    const where = this.ticketWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        ...(paginate ? { skip: (query.page - 1) * query.pageSize, take: query.pageSize } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          site: { include: { client: true } }, category: true, priority: true,
          responses: { where: { type: 'OFFICIAL_INITIAL_RESPONSE' }, take: 1, include: { createdBy: { select: { displayName: true } } } },
          slaInstances: { where: { slaType: SlaType.RESPOND }, take: 1 },
          assignments: { include: { assignedBy: { select: { displayName: true } }, members: { include: { technician: { select: { id: true, displayName: true } }, slaInstances: { where: { slaType: SlaType.WORK } }, checkins: { orderBy: { serverReceivedAt: 'asc' }, take: 1 } } } }, orderBy: { assignedAt: 'asc' } }
        }
      }),
      this.prisma.ticket.count({ where })
    ]);
    const data = items.map((ticket: any) => this.ticketRow(ticket));
    return { data, meta: { page: query.page, pageSize: paginate ? query.pageSize : data.length, total } };
  }

  async technicians(query: ReportQueryDto, paginate = true) {
    const where: Prisma.AssignmentMemberWhereInput = {
      ...(query.technicianId ? { technicianId: query.technicianId } : {}),
      assignment: { ticket: this.ticketWhere(query) }
    };
    const [items, total] = await Promise.all([
      this.prisma.assignmentMember.findMany({
        where, ...(paginate ? { skip: (query.page - 1) * query.pageSize, take: query.pageSize } : {}), orderBy: { assignedAt: 'desc' },
        include: {
          technician: { select: { id: true, displayName: true } }, slaInstances: { where: { slaType: SlaType.WORK } },
          assignment: { include: { assignedBy: { select: { displayName: true } }, ticket: { include: { site: { include: { client: true } }, priority: true } } } },
          checkins: { orderBy: { serverReceivedAt: 'asc' }, take: 1 }, workCompletions: { orderBy: { completedAt: 'desc' }, take: 1 }
        }
      }), this.prisma.assignmentMember.count({ where })
    ]);
    const data = items.map((member: any) => {
      const sla = member.slaInstances[0];
      const runtime = sla ? evaluateSla(sla) : null;
      const assignmentElapsed = member.completedAt ? Math.max(0, Math.floor((member.completedAt.getTime() - member.assignedAt.getTime()) / 1000)) : null;
      const onsiteElapsed = member.completedAt && member.firstCheckinAt ? Math.max(0, Math.floor((member.completedAt.getTime() - member.firstCheckinAt.getTime()) / 1000)) : null;
      return {
        memberId: member.id, ticketCode: member.assignment.ticket.ticketCode, client: member.assignment.ticket.site.client.name,
        site: member.assignment.ticket.site.name, priority: member.assignment.ticket.priority.code, technician: member.technician.displayName,
        technicianId: member.technician.id, role: member.isLead ? 'LEAD' : 'MEMBER', assignedBy: member.assignment.assignedBy.displayName,
        assignedAt: member.assignedAt, acceptedAt: member.acceptedAt, rejectedAt: member.rejectedAt, firstCheckinAt: member.firstCheckinAt,
        workStartedAt: member.workStartedAt, completedAt: member.completedAt, assignmentElapsedSeconds: assignmentElapsed,
        onsiteWorkElapsedSeconds: onsiteElapsed, slaTargetSeconds: sla?.targetSeconds ?? null,
        slaDueAt: sla?.dueAt ?? null,
        slaOutcome: runtime ? (runtime.outcome ?? runtime.status) : null,
        breachSeconds: runtime?.breachSeconds ?? 0,
        completionSummary: member.completionSummary, memberStatus: member.status, serviceCycleNo: member.assignment.serviceCycleNo
      };
    });
    return { data, meta: { page: query.page, pageSize: paginate ? query.pageSize : data.length, total } };
  }

  async summary(query: ReportQueryDto) {
    const ticketReport = await this.tickets({ ...query, page: 1, pageSize: 500 }, false);
    const technicianReport = await this.technicians({ ...query, page: 1, pageSize: 500 }, false);
    const tickets = ticketReport.data;
    const technicians = technicianReport.data;
    const respondEligible = tickets.filter((row: any) => row.slaRespondStatus && !['TERMINATED_REJECTED', 'CANCELLED'].includes(String(row.slaRespondStatus)));
    const workEligible = technicians.filter((row: any) => !['REASSIGNED', 'REMOVED', 'CANCELLED'].includes(String(row.slaOutcome)) && row.completedAt);

    const now = new Date().getTime();
    let totalRespondTime = 0;
    tickets.forEach((t: any) => {
      const start = t.createdAt instanceof Date ? t.createdAt.getTime() : new Date(t.createdAt).getTime();
      const end = t.firstRespondedAt ? (t.firstRespondedAt instanceof Date ? t.firstRespondedAt.getTime() : new Date(t.firstRespondedAt).getTime()) : now;
      totalRespondTime += (end - start);
    });
    const mttrRespondHours = tickets.length ? (totalRespondTime / tickets.length) / 3600000 : 0;
    const staticRespondTargetHours = 2;
    const mttrRespondPercentage = tickets.length === 0 ? 100 : (mttrRespondHours <= staticRespondTargetHours ? 100 : (staticRespondTargetHours / mttrRespondHours) * 100);

    let totalResolutionTime = 0;
    let totalTargetResolutionTime = 0;
    let resolutionCount = 0;
    tickets.forEach((t: any) => {
      // Kecepatan Selesai dimulai saat teknisi yang ditugaskan pertama kali
      // check-in, bukan sejak assignment dibuat. Tiket tanpa check-in diabaikan.
      if (!t.firstCheckinAt) return;

      const start = new Date(t.firstCheckinAt).getTime();
      // Untuk pekerjaan yang belum di-resolve, durasi tetap berjalan sampai sekarang.
      const end = t.resolvedAt ? new Date(t.resolvedAt).getTime() : now;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;

      totalResolutionTime += end - start;
      totalTargetResolutionTime += (t.slaWorkTargetSeconds ?? 0) * 1000;
      resolutionCount++;
    });
    const mttrResolutionHours = resolutionCount ? (totalResolutionTime / resolutionCount) / 3600000 : 0;
    const averageTargetResolutionHours = resolutionCount ? (totalTargetResolutionTime / resolutionCount) / 3600000 : 0;
    const mttrResolutionPercentage = resolutionCount === 0 ? 100 : (mttrResolutionHours <= averageTargetResolutionHours ? 100 : (averageTargetResolutionHours / mttrResolutionHours) * 100);

    return {
      tickets: {
        total: ticketReport.meta.total,
        byStatus: Object.fromEntries(Object.values(TicketStatus).map((status: any) => [status, tickets.filter((item: any) => item.status === status).length]))
      },
      mttr: {
        respondHours: parseFloat(mttrRespondHours.toFixed(2)),
        resolutionHours: parseFloat(mttrResolutionHours.toFixed(2)),
        respondPercentage: Math.round(mttrRespondPercentage),
        resolutionPercentage: Math.round(mttrResolutionPercentage)
      },
      slaRespond: {
        eligible: respondEligible.length,
        met: respondEligible.filter((item: any) => item.slaRespondOutcome === 'MET').length,
        breached: respondEligible.filter((item: any) => ['BREACHED', 'COMPLETED_BREACHED'].includes(String(item.slaRespondOutcome ?? item.slaRespondStatus))).length
      },
      slaWork: {
        eligible: workEligible.length,
        met: workEligible.filter((item: any) => item.slaOutcome === 'MET').length,
        breached: workEligible.filter((item: any) => ['BREACHED', 'COMPLETED_BREACHED'].includes(String(item.slaOutcome))).length,
        active: technicians.filter((item: any) => !item.completedAt && !['REASSIGNED', 'REMOVED', 'REJECTED'].includes(String(item.memberStatus))).length
      }
    };
  }

  async export(query: ReportQueryDto, actor: AuthUser): Promise<Buffer> {
    const [ticketReport, techReport, summary] = await Promise.all([this.tickets({ ...query, page: 1, pageSize: 500 }, false), this.technicians({ ...query, page: 1, pageSize: 500 }, false), this.summary(query)]);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = actor.displayName;
    workbook.created = new Date();
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRows([
      ['Metric', 'Value'], ['Total Tickets', summary.tickets.total],
      ['MTTR Response (Jam)', summary.mttr.respondHours],
      ['MTTR Resolution (Jam)', summary.mttr.resolutionHours],
      ['SLA Respond Eligible', summary.slaRespond.eligible],
      ['SLA Respond Met', summary.slaRespond.met], ['SLA Respond Breached', summary.slaRespond.breached],
      ['SLA Work Eligible', summary.slaWork.eligible], ['SLA Work Met', summary.slaWork.met], ['SLA Work Breached', summary.slaWork.breached]
    ]);
    const ticketsSheet = workbook.addWorksheet('Tickets');
    this.addObjectRows(ticketsSheet, ticketReport.data);
    const techSheet = workbook.addWorksheet('Technician SLA');
    this.addObjectRows(techSheet, techReport.data);
    const metaSheet = workbook.addWorksheet('Filters & Metadata');
    metaSheet.addRows([
      ['Exported At', new Date().toISOString()], ['Timezone', 'Asia/Makassar'], ['Actor', actor.displayName],
      ['Filters', JSON.stringify(query)], ['Report Version', '1.0.0']
    ]);
    for (const sheet of workbook.worksheets) {
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.getRow(1).font = { bold: true };
      sheet.columns.forEach((column: any) => {
        const values = Array.isArray(column.values) ? column.values.slice(1) : [];
        column.width = Math.min(45, Math.max(14, ...values.map((value: any) => String(value ?? '').length + 2)));
      });
      if (sheet.rowCount > 1 && sheet.columnCount > 0) {
        sheet.autoFilter = { from: 'A1', to: `${this.columnLetter(sheet.columnCount)}1` };
      }
    }
    await this.audit.write({ actorUserId: actor.id, action: 'REPORT_EXPORTED', resourceType: 'report', after: { filters: query, ticketRows: ticketReport.data.length, technicianRows: techReport.data.length } });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private ticketWhere(query: ReportQueryDto): Prisma.TicketWhereInput {
    return {
      ...(query.dateFrom || query.dateTo ? { createdAt: { ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}), ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}) } } : {}),
      ...(query.clientId ? { site: { clientId: query.clientId } } : {}), ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}), ...(query.priorityId ? { priorityId: query.priorityId } : {}),
      ...(query.status ? { status: query.status as TicketStatus } : {}),
      ...(query.technicianId ? { assignments: { some: { members: { some: { technicianId: query.technicianId } } } } } : {}),
      ...(query.search ? { OR: [{ ticketCode: { contains: query.search, mode: 'insensitive' } }, { picName: { contains: query.search, mode: 'insensitive' } }, { reporterName: { contains: query.search, mode: 'insensitive' } }] } : {})
    };
  }

  private ticketRow(ticket: any) {
    const respond = ticket.slaInstances[0];
    const respondRuntime = respond ? evaluateSla(respond) : null;
    const members = ticket.assignments.flatMap((assignment: any) => assignment.members);
    // Reopen membuat serviceCycleNo baru. Jangan gunakan check-in atau SLA
    // dari siklus sebelumnya untuk menghitung durasi pekerjaan saat ini.
    const currentCycleMembers = ticket.assignments
      .filter((assignment: any) => assignment.serviceCycleNo === ticket.serviceCycleNo)
      .flatMap((assignment: any) => assignment.members);
    const firstCheckinAt = currentCycleMembers.reduce(
      (earliest: Date | null, member: any) => {
        const checkin: Date | null = member.firstCheckinAt;
        return checkin && (!earliest || checkin.getTime() < earliest.getTime()) ? checkin : earliest;
      },
      null as Date | null,
    );

    // Only count Work SLA for required members who have already checked in.
    // Members who are assigned but have not yet checked in are NOT_STARTED
    // and must not contribute to the aggregate until work actually begins.
    const activeRequired = currentCycleMembers.filter(
      (member: any) => member.requiredForResolution && !member.endedAt && member.firstCheckinAt,
    );

    const workSlas = activeRequired.map((member: any) => member.slaInstances[0]).filter(Boolean);
    const workRuntimes = workSlas.map((sla: any) => evaluateSla(sla));

    const aggregate =
      workRuntimes.some((r: any) => r.status === SlaStatus.BREACHED || r.outcome === SlaOutcome.COMPLETED_BREACHED) ? 'BREACHED'
        : workRuntimes.some((r: any) => r.status === SlaStatus.WARNING) ? 'WARNING'
          : workRuntimes.length && workRuntimes.every((r: any) => r.outcome === SlaOutcome.MET) ? 'MET'
            : workRuntimes.length ? 'ON_TRACK'
              : 'NOT_STARTED';

    return {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      client: ticket.site.client.name,
      site: ticket.site.name,
      reporter: ticket.reporterName,
      pic: ticket.picName,
      category: ticket.category?.name,
      priority: ticket.priority.code,
      status: ticket.status,
      createdAt: ticket.createdAt,
      firstRespondedAt: ticket.firstRespondedAt,
      assignedAt: ticket.assignments[0]?.assignedAt,
      firstCheckinAt,
      resolvedAt: ticket.resolvedAt,
      closedAt: ticket.closedAt,
      respondedBy: ticket.responses[0]?.createdBy.displayName,
      assignedBy: ticket.assignments.at(-1)?.assignedBy.displayName,
      leadTechnician: members.find((m: any) => m.isLead && !m.endedAt)?.technician.displayName,
      technicians: members.map((m: any) => m.technician.displayName).join(', '),

      // Respond SLA
      slaRespondTargetSeconds: respond?.targetSeconds,
      slaRespondDueAt: respond?.dueAt,
      slaRespondElapsedSeconds: respondRuntime?.elapsedSeconds,
      slaRespondStatus: respondRuntime?.status,
      slaRespondOutcome: respondRuntime?.outcome,
      slaRespondBreachSeconds: respondRuntime?.breachSeconds ?? 0,

      // Work SLA — only populated after the first check-in; returns NOT_STARTED before that
      slaWorkTargetSeconds: workSlas[0]?.targetSeconds ?? null,
      slaWorkAggregate: aggregate,
      workMetCount: workRuntimes.filter(
        (runtime: any) => runtime.outcome === SlaOutcome.MET,
      ).length,
      workBreachedCount: workRuntimes.filter(
        (runtime: any) =>
          runtime.status === SlaStatus.BREACHED ||
          runtime.outcome === SlaOutcome.COMPLETED_BREACHED,
      ).length,
      workActiveCount: workRuntimes.filter(
        (runtime: any) => !runtime.outcome,
      ).length,

      serviceCycleNo: ticket.serviceCycleNo,
    };
  }

  private addObjectRows(sheet: ExcelJS.Worksheet, rows: Record<string, unknown>[]) {
    if (!rows.length) { sheet.addRow(['No data']); return; }
    const keys = Object.keys(rows[0]);
    sheet.addRow(keys);
    for (const row of rows) sheet.addRow(keys.map((key) => sanitizeExcelCell(row[key] instanceof Date ? (row[key] as Date).toISOString() : row[key])));
  }

  private columnLetter(column: number): string {
    let value = ''; let current = column;
    while (current > 0) { const modulo = (current - 1) % 26; value = String.fromCharCode(65 + modulo) + value; current = Math.floor((current - modulo) / 26); }
    return value;
  }
}
