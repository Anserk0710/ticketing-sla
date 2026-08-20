import { SlaOutcome, SlaStatus } from '@prisma/client';

export interface SlaSnapshot {
  status: SlaStatus;
  outcome: SlaOutcome | null;
  elapsedSeconds: number;
  breachSeconds: number;
  percentage: number;
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function evaluateSla(input: {
  startedAt: Date;
  warningAt: Date;
  dueAt: Date;
  completedAt?: Date | null;
  endedAt?: Date | null;
  outcome?: SlaOutcome | null;
  now?: Date;
}): SlaSnapshot {
  const now = input.now ?? new Date();
  const end = input.completedAt ?? input.endedAt ?? now;
  const elapsedSeconds = Math.max(0, Math.floor((end.getTime() - input.startedAt.getTime()) / 1000));
  const targetSeconds = Math.max(1, Math.floor((input.dueAt.getTime() - input.startedAt.getTime()) / 1000));
  const breachSeconds = Math.max(0, Math.floor((end.getTime() - input.dueAt.getTime()) / 1000));
  let status: SlaStatus;
  let outcome = input.outcome ?? null;
  if (input.completedAt) {
    status = SlaStatus.COMPLETED;
    outcome ??= input.completedAt <= input.dueAt ? SlaOutcome.MET : SlaOutcome.COMPLETED_BREACHED;
  } else if (input.endedAt) {
    status = SlaStatus.ENDED;
  } else if (now > input.dueAt) {
    status = SlaStatus.BREACHED;
  } else if (now >= input.warningAt) {
    status = SlaStatus.WARNING;
  } else {
    status = SlaStatus.OPEN;
  }
  return { status, outcome, elapsedSeconds, breachSeconds, percentage: Math.min(999, Math.round((elapsedSeconds / targetSeconds) * 100)) };
}
