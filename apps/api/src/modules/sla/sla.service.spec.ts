import {
  SlaEventType,
  SlaStatus,
  SlaType,
} from '@prisma/client';

import { SlaService } from './sla.service';

describe('SlaService.createWork', () => {
  it('upserts and resets a legacy WORK SLA from the actual check-in time', async () => {
    const policy = {
      id: 'policy-id',
      priority: { code: 'HIGH' },
      workTargetSeconds: 3600,
      warningThresholdPercent: 75,
    };
    const upsert = jest.fn().mockResolvedValue({ id: 'sla-id' });
    const tx = {
      slaPolicyVersion: {
        findFirstOrThrow: jest.fn().mockResolvedValue(policy),
      },
      slaInstance: { upsert },
    } as any;
    const service = new SlaService({} as any, {} as any);
    const assignedAt = new Date('2026-08-24T01:00:00.000Z');
    const checkedInAt = new Date('2026-08-24T02:00:00.000Z');

    await service.createWork(
      { id: 'member-id', assignedAt },
      { serviceCycleNo: 1, priorityId: 'priority-id' },
      checkedInAt,
      tx,
    );

    expect(upsert).toHaveBeenCalledWith({
      where: {
        slaType_assignmentMemberId: {
          slaType: SlaType.WORK,
          assignmentMemberId: 'member-id',
        },
      },
      create: expect.objectContaining({
        slaType: SlaType.WORK,
        assignmentMemberId: 'member-id',
        startedAt: checkedInAt,
        events: { create: { type: SlaEventType.STARTED } },
      }),
      update: expect.objectContaining({
        startedAt: checkedInAt,
        status: SlaStatus.OPEN,
        completedAt: null,
        endedAt: null,
        outcome: null,
        breachedAt: null,
        breachSeconds: 0,
        events: {
          create: {
            type: SlaEventType.RECALCULATED,
            metadata: { reason: 'WORK_STARTED_AT_CHECKIN' },
          },
        },
      }),
    });
  });
});
