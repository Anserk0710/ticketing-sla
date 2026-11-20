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
});
