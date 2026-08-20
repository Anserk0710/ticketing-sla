import { SlaOutcome, SlaStatus } from '@prisma/client';
import { evaluateSla } from './sla';

describe('evaluateSla', () => {
  const startedAt = new Date('2026-01-01T00:00:00Z');
  const warningAt = new Date('2026-01-01T00:45:00Z');
  const dueAt = new Date('2026-01-01T01:00:00Z');
  it('marks exact deadline completion as MET', () => {
    const result = evaluateSla({ startedAt, warningAt, dueAt, completedAt: dueAt });
    expect(result.status).toBe(SlaStatus.COMPLETED);
    expect(result.outcome).toBe(SlaOutcome.MET);
    expect(result.breachSeconds).toBe(0);
  });
  it('marks active overdue as breached', () => {
    const result = evaluateSla({ startedAt, warningAt, dueAt, now: new Date('2026-01-01T01:01:00Z') });
    expect(result.status).toBe(SlaStatus.BREACHED);
    expect(result.breachSeconds).toBe(60);
  });
});
