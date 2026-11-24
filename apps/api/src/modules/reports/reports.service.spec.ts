import { ReportsService } from './reports.service';

describe('ReportsService - Kecepatan Selesai', () => {
  const query = { page: 1, pageSize: 50 };
  const date = (hour: number) => new Date(`2026-11-20T${String(hour).padStart(2, '0')}:00:00.000Z`);

  const createService = () => new ReportsService({} as any, {} as any);

  it('starts at the earliest assigned technician check-in within the current service cycle', () => {
    const service = createService();
    const member = (firstCheckinAt: Date | null) => ({
      firstCheckinAt,
      requiredForResolution: true,
      endedAt: null,
      slaInstances: [],
      technician: { displayName: 'Teknisi' },
    });
    const ticket = {
      id: 'ticket-1', ticketCode: 'T-001', serviceCycleNo: 2,
      site: { name: 'Site', client: { name: 'Client' } },
      category: null, priority: { code: 'HIGH' }, slaInstances: [], responses: [],
      assignments: [
        { serviceCycleNo: 1, assignedAt: date(0), assignedBy: { displayName: 'Admin' }, members: [member(date(1))] },
        { serviceCycleNo: 2, assignedAt: date(2), assignedBy: { displayName: 'Admin' }, members: [member(date(9)), member(date(3)), member(null)] },
      ],
    };

    const row = (service as any).ticketRow(ticket);
    expect(row.firstCheckinAt).toEqual(date(3));
    expect(row.slaWorkAggregate).toBe('NOT_STARTED');
  });

  it('excludes tickets before attendance, and measures checked-in tickets until resolve', async () => {
    const service = createService();
    jest.spyOn(service, 'tickets').mockResolvedValue({
      data: [
        { createdAt: date(0), assignedAt: date(0), firstCheckinAt: date(2), resolvedAt: date(4), slaWorkTargetSeconds: 10800, status: 'RESOLVED' },
        { createdAt: date(0), assignedAt: date(0), firstCheckinAt: null, resolvedAt: null, slaWorkTargetSeconds: 10800, status: 'ASSIGNED' },
      ],
      meta: { total: 2 },
    } as any);
    jest.spyOn(service, 'technicians').mockResolvedValue({ data: [], meta: { total: 0 } } as any);

    const summary = await service.summary(query);
    expect(summary.mttr.resolutionHours).toBe(2); // Bukan 4 jam sejak assignment.
    expect(summary.mttr.resolutionPercentage).toBe(100);
    expect(summary.tickets.total).toBe(2);
  });

  it('keeps counting checked-in unresolved tickets until now', async () => {
    jest.useFakeTimers().setSystemTime(date(6));
    try {
      const service = createService();
      jest.spyOn(service, 'tickets').mockResolvedValue({
        data: [{ createdAt: date(0), assignedAt: date(0), firstCheckinAt: date(3), resolvedAt: null, slaWorkTargetSeconds: 3600, status: 'IN_PROGRESS' }],
        meta: { total: 1 },
      } as any);
      jest.spyOn(service, 'technicians').mockResolvedValue({ data: [], meta: { total: 0 } } as any);

      const summary = await service.summary(query);
      expect(summary.mttr.resolutionHours).toBe(3);
      expect(summary.mttr.resolutionPercentage).toBe(33);
    } finally {
      jest.useRealTimers();
    }
  });

  it('exports a human-readable Excel workbook with 4 styled worksheets', async () => {
    const auditMock = { write: jest.fn().mockResolvedValue(undefined) };
    const service = new ReportsService({} as any, auditMock as any);

    jest.spyOn(service, 'tickets').mockResolvedValue({
      data: [
        {
          ticketCode: 'TCK-2026-0001',
          client: 'Bank CIMB',
          site: 'Cabang Makassar',
          category: 'Network',
          priority: 'P1',
          status: 'RESOLVED',
          reporter: 'Budi',
          pic: 'Ahmad',
          respondedBy: 'Helpdesk 1',
          leadTechnician: 'Tech Lead',
          technicians: 'Tech Lead, Tech 2',
          createdAt: date(0),
          firstRespondedAt: date(1),
          slaRespondElapsedSeconds: 3600,
          slaRespondOutcome: 'MET',
          firstCheckinAt: date(2),
          resolvedAt: date(4),
          closedAt: date(5),
          slaWorkElapsedSeconds: 7200,
          slaWorkAggregate: 'MET',
        },
      ],
      meta: { total: 1 },
    } as any);

    jest.spyOn(service, 'technicians').mockResolvedValue({
      data: [
        {
          ticketCode: 'TCK-2026-0001',
          technician: 'Tech Lead',
          role: 'LEAD',
          client: 'Bank CIMB',
          site: 'Cabang Makassar',
          priority: 'P1',
          assignedBy: 'Admin',
          assignedAt: date(1),
          firstCheckinAt: date(2),
          completedAt: date(4),
          onsiteWorkElapsedSeconds: 7200,
          slaTargetSeconds: 14400,
          slaDueAt: date(6),
          slaOutcome: 'MET',
          breachSeconds: 0,
          completionSummary: 'Perbaikan selesai dengan baik',
        },
      ],
      meta: { total: 1 },
    } as any);

    jest.spyOn(service, 'summary').mockResolvedValue({
      tickets: { total: 1, byStatus: { RESOLVED: 1 } },
      mttr: { respondHours: 1, resolutionHours: 2, respondPercentage: 100, resolutionPercentage: 100 },
      slaRespond: { eligible: 1, met: 1, breached: 0 },
      slaWork: { eligible: 1, met: 1, breached: 0, active: 0 },
    } as any);

    const actor = { id: 'user-1', displayName: 'Manager Operasional' };
    const buffer = await service.export({ page: 1, pageSize: 50 }, actor as any);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    expect(sheetNames).toEqual([
      'Ringkasan Eksekutif',
      'Data Tiket',
      'Kinerja Teknisi',
      'Informasi Laporan',
    ]);

    // Check Data Tiket sheet columns
    const ticketSheet = workbook.getWorksheet('Data Tiket')!;
    const headerRow = ticketSheet.getRow(1);
    const headers = headerRow.values as string[];
    expect(headers).toContain('No. Tiket');
    expect(headers).toContain('Klien');
    expect(headers).toContain('Status SLA Respon');
    expect(headers).toContain('Status SLA Pengerjaan');
    expect(headers).toContain('Durasi Respon');
    expect(headers).toContain('Durasi Pengerjaan');
    expect(headers).not.toContain('ticketCode');
    expect(headers).not.toContain('ticketId');
    expect(headers).not.toContain('slaRespondElapsedSeconds');

    // Check Data row values
    const dataRow = ticketSheet.getRow(2);
    expect(dataRow.getCell(2).value).toBe('TCK-2026-0001');
    expect(dataRow.getCell(6).value).toBe('P1 (Kritis)');
    expect(dataRow.getCell(7).value).toBe('Selesai Ditangani');
    expect(dataRow.getCell(15).value).toBe('1 Jam');
    expect(dataRow.getCell(16).value).toBe('Tepat Waktu (Achieved)');

    // Check Kinerja Teknisi sheet
    const techSheet = workbook.getWorksheet('Kinerja Teknisi')!;
    const techHeader = techSheet.getRow(1).values as string[];
    expect(techHeader).toContain('Nama Teknisi');
    expect(techHeader).toContain('Peran Tim');
    expect(techHeader).toContain('Status SLA Teknisi');
    expect(techHeader).toContain('Keterlambatan (Breach)');
    expect(techHeader).not.toContain('memberId');
    expect(techHeader).not.toContain('technicianId');

    const techDataRow = techSheet.getRow(2);
    expect(techDataRow.getCell(4).value).toBe('Koordinator (Lead)');
    expect(techDataRow.getCell(12).value).toBe('2 Jam');
    expect(techDataRow.getCell(16).value).toBe('Tepat Waktu');

    // Check audit logged
    expect(auditMock.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user-1',
        action: 'REPORT_EXPORTED',
      }),
    );
  });
});
