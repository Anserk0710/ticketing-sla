import { Injectable } from '@nestjs/common';
import { Prisma, SlaOutcome, SlaStatus, SlaType, TicketStatus } from '@prisma/client';
import ExcelJS from 'exceljs';
import { AuthUser } from '../../common/types/auth-user';
import {
  formatExcelDateTime,
  formatExcelDuration,
  formatPriority,
  formatSlaStatus,
  formatTicketStatus,
  sanitizeExcelCell,
} from '../../common/utils/excel';
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
    const [ticketReport, techReport, summary] = await Promise.all([
      this.tickets({ ...query, page: 1, pageSize: 500 }, false),
      this.technicians({ ...query, page: 1, pageSize: 500 }, false),
      this.summary(query),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = actor.displayName;
    workbook.lastModifiedBy = actor.displayName;
    workbook.created = new Date();
    workbook.modified = new Date();

    this.buildSummarySheet(workbook, summary, actor, query);
    this.buildTicketsSheet(workbook, ticketReport.data);
    this.buildTechniciansSheet(workbook, techReport.data);
    this.buildInfoSheet(workbook, actor, query, ticketReport.data.length, techReport.data.length);

    await this.audit.write({
      actorUserId: actor.id,
      action: 'REPORT_EXPORTED',
      resourceType: 'report',
      after: {
        filters: query,
        ticketRows: ticketReport.data.length,
        technicianRows: techReport.data.length,
      },
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private buildSummarySheet(workbook: ExcelJS.Workbook, summary: any, actor: AuthUser, query: ReportQueryDto) {
    const sheet = workbook.addWorksheet('Ringkasan Eksekutif');
    sheet.views = [{ showGridLines: true }];

    sheet.getColumn('A').width = 4;
    sheet.getColumn('B').width = 34;
    sheet.getColumn('C').width = 20;
    sheet.getColumn('D').width = 24;
    sheet.getColumn('E').width = 54;

    const titleFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A60' } };
    const sectionFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    const tableHeaderFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    const zebraFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    const whiteFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    // Row 2: Banner Title
    sheet.mergeCells('B2:E2');
    const titleCell = sheet.getCell('B2');
    titleCell.value = 'RINGKASAN EKSEKUTIF - LAPORAN OPERASIONAL & SLA';
    titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = titleFill;
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(2).height = 32;

    // Row 3: Subtitle
    sheet.mergeCells('B3:E3');
    const subCell = sheet.getCell('B3');
    subCell.value = `Waktu Penarikan: ${formatExcelDateTime(new Date())} WITA  |  Ditarik Oleh: ${actor.displayName}  |  Zona Waktu: Asia/Makassar (WITA)`;
    subCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF475569' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(3).height = 20;

    // Row 5: Section A
    sheet.mergeCells('B5:E5');
    const s1Cell = sheet.getCell('B5');
    s1Cell.value = 'A. INDIKATOR KINERJA UTAMA (KPI & SLA)';
    s1Cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1F3A60' } };
    s1Cell.fill = sectionFill;
    s1Cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(5).height = 24;

    // Row 6: KPI Table Headers
    const kpiHeaders = ['Indikator Kinerja', 'Target Standar', 'Pencapaian', 'Status & Keterangan'];
    const kpiHeaderRow = sheet.getRow(6);
    kpiHeaderRow.height = 24;
    kpiHeaders.forEach((text, i) => {
      const colLetter = String.fromCharCode(66 + i); // B, C, D, E
      const cell = sheet.getCell(`${colLetter}6`);
      cell.value = text;
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = tableHeaderFill;
      cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0 };
      cell.border = thinBorder;
    });

    const kpiData = [
      [
        'Tingkat Kepatuhan SLA Respon',
        '100%',
        `${summary.mttr.respondPercentage}%`,
        `${summary.slaRespond.met} tepat waktu dari ${summary.slaRespond.eligible} tiket dievaluasi (${summary.slaRespond.breached} terlambat)`,
      ],
      [
        'Rata-rata Waktu Respon Awal',
        '≤ 2 Jam',
        `${summary.mttr.respondHours} Jam`,
        'Rata-rata durasi sejak tiket dibuat hingga staf pertama merespon',
      ],
      [
        'Tingkat Kepatuhan SLA Pengerjaan',
        '100%',
        `${summary.mttr.resolutionPercentage}%`,
        `${summary.slaWork.met} tepat waktu dari ${summary.slaWork.eligible} pekerjaan selesai (${summary.slaWork.breached} terlambat)`,
      ],
      [
        'Rata-rata Waktu Pengerjaan Selesai',
        'Sesuai Target SLA',
        `${summary.mttr.resolutionHours} Jam`,
        'Rata-rata durasi pengerjaan dihitung sejak teknisi check-in di lokasi',
      ],
      [
        'Total Tiket Masuk',
        '—',
        `${summary.tickets.total} Tiket`,
        'Total tiket dalam lingkup filter laporan yang dipilih',
      ],
      [
        'Teknisi Masih Aktif di Lapangan',
        '—',
        `${summary.slaWork.active} Tugas`,
        'Penugasan teknisi yang sedang berjalan dan belum selesai',
      ],
    ];

    let currentRow = 7;
    kpiData.forEach((row, idx) => {
      const r = sheet.getRow(currentRow);
      r.height = 22;
      row.forEach((val, colIdx) => {
        const colLetter = String.fromCharCode(66 + colIdx);
        const cell = sheet.getCell(`${colLetter}${currentRow}`);
        cell.value = val;
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.fill = idx % 2 === 0 ? whiteFill : zebraFill;
        cell.border = thinBorder;
        cell.alignment = {
          vertical: 'middle',
          horizontal: colIdx === 0 || colIdx === 3 ? 'left' : 'center',
          indent: colIdx === 0 || colIdx === 3 ? 1 : 0,
        };
        if (colIdx === 2) {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1F3A60' } };
        }
      });
      currentRow++;
    });

    // Section B: Status Distribution
    currentRow++;
    sheet.mergeCells(`B${currentRow}:E${currentRow}`);
    const s2Cell = sheet.getCell(`B${currentRow}`);
    s2Cell.value = 'B. DISTRIBUSI STATUS TIKET SAAT INI';
    s2Cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1F3A60' } };
    s2Cell.fill = sectionFill;
    s2Cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(currentRow).height = 24;

    currentRow++;
    const distHeaders = ['Status Tiket', 'Jumlah Tiket', 'Persentase', 'Keterangan Operasional'];
    const distHeaderRow = sheet.getRow(currentRow);
    distHeaderRow.height = 24;
    distHeaders.forEach((text, i) => {
      const colLetter = String.fromCharCode(66 + i);
      const cell = sheet.getCell(`${colLetter}${currentRow}`);
      cell.value = text;
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = tableHeaderFill;
      cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0 };
      cell.border = thinBorder;
    });

    const statusDescriptions: Record<string, string> = {
      NEW: 'Tiket baru dibuat, menunggu respon & penugasan staf',
      RESPONDED: 'Tiket telah direspon awal oleh staf helpdesk',
      ASSIGNED: 'Teknisi telah ditugaskan, menuju ke lokasi atau bersiap',
      ON_SITE: 'Teknisi telah melakukan check-in di lokasi site',
      IN_PROGRESS: 'Pekerjaan perbaikan/pemeliharaan sedang berlangsung',
      PENDING: 'Pekerjaan ditunda sementara (menunggu suku cadang/klien)',
      RESOLVED: 'Pekerjaan teknis telah selesai, menunggu konfirmasi penutupan',
      CLOSED: 'Tiket resmi ditutup dan dikonfirmasi tuntas',
      REOPENED: 'Tiket dibuka kembali untuk penanganan atau perbaikan lanjutan',
      CANCELLED: 'Tiket dibatalkan oleh pelapor atau administrator',
    };

    currentRow++;
    let distIdx = 0;
    for (const status of Object.values(TicketStatus)) {
      const count = summary.tickets.byStatus?.[status] ?? 0;
      const pct = summary.tickets.total ? Math.round((count / summary.tickets.total) * 100) : 0;
      const r = sheet.getRow(currentRow);
      r.height = 21;

      const rowValues = [
        formatTicketStatus(status),
        count,
        `${pct}%`,
        statusDescriptions[status] || '—',
      ];

      rowValues.forEach((val, cIdx) => {
        const colLetter = String.fromCharCode(66 + cIdx);
        const cell = sheet.getCell(`${colLetter}${currentRow}`);
        cell.value = val;
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.fill = distIdx % 2 === 0 ? whiteFill : zebraFill;
        cell.border = thinBorder;
        cell.alignment = {
          vertical: 'middle',
          horizontal: cIdx === 0 || cIdx === 3 ? 'left' : 'center',
          indent: cIdx === 0 || cIdx === 3 ? 1 : 0,
        };
        if (cIdx === 1) {
          cell.font = { name: 'Segoe UI', size: 10, bold: count > 0 };
        }
      });

      currentRow++;
      distIdx++;
    }
  }

  private buildTicketsSheet(workbook: ExcelJS.Workbook, tickets: any[]) {
    const sheet = workbook.addWorksheet('Data Tiket');
    sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }];

    const columns = [
      { header: 'No.', key: 'no', width: 6, align: 'center' },
      { header: 'No. Tiket', key: 'ticketCode', width: 18, align: 'center', bold: true },
      { header: 'Klien', key: 'client', width: 26, align: 'left' },
      { header: 'Lokasi / Site', key: 'site', width: 24, align: 'left' },
      { header: 'Kategori Masalah', key: 'category', width: 22, align: 'left' },
      { header: 'Prioritas', key: 'priority', width: 16, align: 'center' },
      { header: 'Status Tiket', key: 'status', width: 20, align: 'center' },
      { header: 'Nama Pelapor', key: 'reporter', width: 20, align: 'left' },
      { header: 'PIC Lokasi', key: 'pic', width: 20, align: 'left' },
      { header: 'Direspon Oleh', key: 'respondedBy', width: 20, align: 'left' },
      { header: 'Koordinator Teknisi', key: 'leadTechnician', width: 22, align: 'left' },
      { header: 'Tim Teknisi', key: 'technicians', width: 30, align: 'left' },
      { header: 'Waktu Tiket Masuk', key: 'createdAt', width: 20, align: 'center' },
      { header: 'Waktu Respon Awal', key: 'firstRespondedAt', width: 20, align: 'center' },
      { header: 'Durasi Respon', key: 'respondDuration', width: 18, align: 'center' },
      { header: 'Status SLA Respon', key: 'slaRespond', width: 25, align: 'center' },
      { header: 'Waktu Teknisi Tiba', key: 'firstCheckinAt', width: 20, align: 'center' },
      { header: 'Waktu Selesai Pengerjaan', key: 'resolvedAt', width: 22, align: 'center' },
      { header: 'Waktu Tiket Ditutup', key: 'closedAt', width: 20, align: 'center' },
      { header: 'Durasi Pengerjaan', key: 'workDuration', width: 20, align: 'center' },
      { header: 'Status SLA Pengerjaan', key: 'slaWork', width: 25, align: 'center' },
    ];

    sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));

    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A60' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    const zebraFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    const whiteFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

    if (!tickets.length) {
      const emptyRow = sheet.addRow(['Tidak ada data tiket untuk filter ini']);
      sheet.mergeCells(`A2:${this.columnLetter(columns.length)}2`);
      const emptyCell = sheet.getCell('A2');
      emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
      emptyCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
      emptyRow.height = 30;
      return;
    }

    tickets.forEach((ticket, idx) => {
      const slaRespondStatusText = formatSlaStatus(ticket.slaRespondOutcome ?? ticket.slaRespondStatus);
      const slaWorkStatusText = formatSlaStatus(ticket.slaWorkAggregate);

      const rowData = {
        no: idx + 1,
        ticketCode: sanitizeExcelCell(ticket.ticketCode),
        client: sanitizeExcelCell(ticket.client),
        site: sanitizeExcelCell(ticket.site),
        category: sanitizeExcelCell(ticket.category || '—'),
        priority: formatPriority(ticket.priority),
        status: formatTicketStatus(ticket.status),
        reporter: sanitizeExcelCell(ticket.reporter || '—'),
        pic: sanitizeExcelCell(ticket.pic || '—'),
        respondedBy: sanitizeExcelCell(ticket.respondedBy || '—'),
        leadTechnician: sanitizeExcelCell(ticket.leadTechnician || '—'),
        technicians: sanitizeExcelCell(ticket.technicians || '—'),
        createdAt: formatExcelDateTime(ticket.createdAt),
        firstRespondedAt: formatExcelDateTime(ticket.firstRespondedAt),
        respondDuration: formatExcelDuration(ticket.slaRespondElapsedSeconds),
        slaRespond: slaRespondStatusText,
        firstCheckinAt: formatExcelDateTime(ticket.firstCheckinAt),
        resolvedAt: formatExcelDateTime(ticket.resolvedAt),
        closedAt: formatExcelDateTime(ticket.closedAt),
        workDuration: ticket.slaWorkAggregate === 'NOT_STARTED' || ticket.slaWorkElapsedSeconds == null
          ? '—'
          : formatExcelDuration(ticket.slaWorkElapsedSeconds),
        slaWork: slaWorkStatusText,
      };

      const row = sheet.addRow(rowData);
      row.height = 22;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const colDef = columns[colNumber - 1];
        cell.font = {
          name: 'Segoe UI',
          size: 10,
          bold: colDef?.bold ?? false,
          color: { argb: 'FF1E293B' },
        };
        cell.fill = idx % 2 === 0 ? whiteFill : zebraFill;
        cell.border = thinBorder;
        cell.alignment = {
          vertical: 'middle',
          horizontal: (colDef?.align as any) || 'left',
          wrapText: colDef?.key === 'technicians' || colDef?.key === 'category',
        };

        if (colNumber === 16 || colNumber === 21) {
          this.applySlaBadgeStyle(cell);
        }
      });
    });

    sheet.autoFilter = { from: 'A1', to: `${this.columnLetter(columns.length)}1` };
  }

  private buildTechniciansSheet(workbook: ExcelJS.Workbook, technicians: any[]) {
    const sheet = workbook.addWorksheet('Kinerja Teknisi');
    sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }];

    const columns = [
      { header: 'No.', key: 'no', width: 6, align: 'center' },
      { header: 'No. Tiket', key: 'ticketCode', width: 18, align: 'center', bold: true },
      { header: 'Nama Teknisi', key: 'technician', width: 22, align: 'left' },
      { header: 'Peran Tim', key: 'role', width: 20, align: 'center' },
      { header: 'Klien', key: 'client', width: 26, align: 'left' },
      { header: 'Lokasi / Site', key: 'site', width: 24, align: 'left' },
      { header: 'Prioritas', key: 'priority', width: 16, align: 'center' },
      { header: 'Ditugaskan Oleh', key: 'assignedBy', width: 20, align: 'left' },
      { header: 'Waktu Penugasan', key: 'assignedAt', width: 20, align: 'center' },
      { header: 'Waktu Check-In', key: 'firstCheckinAt', width: 20, align: 'center' },
      { header: 'Waktu Selesai Tugas', key: 'completedAt', width: 20, align: 'center' },
      { header: 'Durasi di Lapangan', key: 'onsiteWork', width: 22, align: 'center' },
      { header: 'Target Waktu (SLA)', key: 'slaTarget', width: 20, align: 'center' },
      { header: 'Batas Waktu (Due Date)', key: 'slaDueAt', width: 20, align: 'center' },
      { header: 'Status SLA Teknisi', key: 'slaOutcome', width: 25, align: 'center' },
      { header: 'Keterlambatan (Breach)', key: 'breach', width: 24, align: 'center' },
      { header: 'Catatan Hasil Pengerjaan', key: 'completionSummary', width: 40, align: 'left' },
    ];

    sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));

    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A60' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    const zebraFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    const whiteFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

    if (!technicians.length) {
      const emptyRow = sheet.addRow(['Tidak ada data kinerja teknisi untuk filter ini']);
      sheet.mergeCells(`A2:${this.columnLetter(columns.length)}2`);
      const emptyCell = sheet.getCell('A2');
      emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
      emptyCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
      emptyRow.height = 30;
      return;
    }

    technicians.forEach((member, idx) => {
      const slaOutcomeText = formatSlaStatus(member.slaOutcome ?? member.memberStatus);
      const breachText = member.breachSeconds && member.breachSeconds > 0
        ? formatExcelDuration(member.breachSeconds)
        : (member.completedAt ? 'Tepat Waktu' : '—');

      const rowData = {
        no: idx + 1,
        ticketCode: sanitizeExcelCell(member.ticketCode),
        technician: sanitizeExcelCell(member.technician),
        role: member.role === 'LEAD' ? 'Koordinator (Lead)' : 'Anggota Tim',
        client: sanitizeExcelCell(member.client),
        site: sanitizeExcelCell(member.site),
        priority: formatPriority(member.priority),
        assignedBy: sanitizeExcelCell(member.assignedBy || '—'),
        assignedAt: formatExcelDateTime(member.assignedAt),
        firstCheckinAt: formatExcelDateTime(member.firstCheckinAt),
        completedAt: formatExcelDateTime(member.completedAt),
        onsiteWork: formatExcelDuration(member.onsiteWorkElapsedSeconds),
        slaTarget: formatExcelDuration(member.slaTargetSeconds),
        slaDueAt: formatExcelDateTime(member.slaDueAt),
        slaOutcome: slaOutcomeText,
        breach: breachText,
        completionSummary: sanitizeExcelCell(member.completionSummary || '—'),
      };

      const row = sheet.addRow(rowData);
      row.height = 22;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const colDef = columns[colNumber - 1];
        cell.font = {
          name: 'Segoe UI',
          size: 10,
          bold: colDef?.bold ?? false,
          color: { argb: 'FF1E293B' },
        };
        cell.fill = idx % 2 === 0 ? whiteFill : zebraFill;
        cell.border = thinBorder;
        cell.alignment = {
          vertical: 'middle',
          horizontal: (colDef?.align as any) || 'left',
          wrapText: colDef?.key === 'completionSummary',
        };

        if (colNumber === 15) {
          this.applySlaBadgeStyle(cell);
        }
      });
    });

    sheet.autoFilter = { from: 'A1', to: `${this.columnLetter(columns.length)}1` };
  }

  private buildInfoSheet(workbook: ExcelJS.Workbook, actor: AuthUser, query: ReportQueryDto, ticketCount: number, techCount: number) {
    const sheet = workbook.addWorksheet('Informasi Laporan');
    sheet.views = [{ showGridLines: true }];

    sheet.getColumn('A').width = 4;
    sheet.getColumn('B').width = 28;
    sheet.getColumn('C').width = 54;

    const titleFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A60' } };
    const tableHeaderFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    const zebraFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    const whiteFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    sheet.mergeCells('B2:C2');
    const titleCell = sheet.getCell('B2');
    titleCell.value = 'INFORMASI & PARAMETER FILTER LAPORAN';
    titleCell.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = titleFill;
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(2).height = 30;

    const headers = ['Parameter Laporan', 'Nilai / Keterangan'];
    const headerRow = sheet.getRow(4);
    headerRow.height = 24;
    headers.forEach((text, i) => {
      const colLetter = String.fromCharCode(66 + i); // B, C
      const cell = sheet.getCell(`${colLetter}4`);
      cell.value = text;
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = tableHeaderFill;
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cell.border = thinBorder;
    });

    const dateRangeText = query.dateFrom || query.dateTo
      ? `${formatExcelDateTime(query.dateFrom)} s/d ${formatExcelDateTime(query.dateTo)}`
      : 'Semua Periode (Tanpa Batasan Tanggal)';

    const rows = [
      ['Nama Dokumen', 'Laporan Operasional Tiket & Evaluasi SLA'],
      ['Waktu Penarikan Laporan', `${formatExcelDateTime(new Date())} WITA`],
      ['Ditarik Oleh', actor.displayName],
      ['Zona Waktu Standar', 'Asia/Makassar (WITA, UTC+8)'],
      ['Periode Tanggal Tiket', dateRangeText],
      ['Filter Status Tiket', query.status ? formatTicketStatus(query.status) : 'Semua Status'],
      ['Kata Kunci Pencarian', query.search ? query.search : 'Tidak Ada (Semua Data)'],
      ['Total Data Tiket Terunduh', `${ticketCount} Tiket`],
      ['Total Catatan Penugasan Teknisi', `${techCount} Penugasan`],
      ['Versi Format Dokumen', '2.0.0'],
    ];

    rows.forEach((row, idx) => {
      const rowNum = 5 + idx;
      const r = sheet.getRow(rowNum);
      r.height = 22;

      const cellB = sheet.getCell(`B${rowNum}`);
      cellB.value = row[0];
      cellB.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1F3A60' } };
      cellB.fill = idx % 2 === 0 ? whiteFill : zebraFill;
      cellB.border = thinBorder;
      cellB.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      const cellC = sheet.getCell(`C${rowNum}`);
      cellC.value = row[1];
      cellC.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF1E293B' } };
      cellC.fill = idx % 2 === 0 ? whiteFill : zebraFill;
      cellC.border = thinBorder;
      cellC.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    });
  }

  private applySlaBadgeStyle(cell: ExcelJS.Cell) {
    const val = String(cell.value || '');
    if (val.includes('Tepat Waktu') || val.includes('Achieved') || val.includes('Tercapai')) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF166534' } };
    } else if (val.includes('Lewat Batas') || val.includes('Breached') || val.includes('Terlambat')) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF991B1B' } };
    } else if (val.includes('Mendekati Batas')) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF92400E' } };
    } else if (val.includes('Sedang Berjalan')) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
    } else if (val.includes('Belum Dimulai')) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF64748B' } };
    }
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
      slaWorkElapsedSeconds: workRuntimes.length
        ? Math.max(...workRuntimes.map((r: any) => r.elapsedSeconds))
        : null,
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

  private columnLetter(column: number): string {
    let value = ''; let current = column;
    while (current > 0) { const modulo = (current - 1) % 26; value = String.fromCharCode(65 + modulo) + value; current = Math.floor((current - modulo) / 26); }
    return value;
  }
}
