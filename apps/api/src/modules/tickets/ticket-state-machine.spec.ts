import { TicketStatus } from '@prisma/client';
import { assertTransition } from './ticket-state-machine';
describe('ticket state machine', () => {
  // existing tests
  it('allows NEW to RESPONDED', () => expect(() => assertTransition(TicketStatus.NEW, TicketStatus.RESPONDED)).not.toThrow());
  it('rejects CLOSED to ASSIGNED', () => expect(() => assertTransition(TicketStatus.CLOSED, TicketStatus.ASSIGNED)).toThrow());
  it('rejects NEW to REJECTED for new operational flow', () => expect(() => assertTransition(TicketStatus.NEW, TicketStatus.REJECTED)).toThrow());
  it('rejects RESPONDED to REJECTED for new operational flow', () => expect(() => assertTransition(TicketStatus.RESPONDED, TicketStatus.REJECTED)).toThrow());

  // Phase 2: transitions INTO PENDING
  it('allows NEW to PENDING', () => expect(() => assertTransition(TicketStatus.NEW, TicketStatus.PENDING)).not.toThrow());
  it('allows RESPONDED to PENDING', () => expect(() => assertTransition(TicketStatus.RESPONDED, TicketStatus.PENDING)).not.toThrow());
  it('allows ASSIGNED to PENDING', () => expect(() => assertTransition(TicketStatus.ASSIGNED, TicketStatus.PENDING)).not.toThrow());
  it('allows ON_SITE to PENDING', () => expect(() => assertTransition(TicketStatus.ON_SITE, TicketStatus.PENDING)).not.toThrow());
  it('allows IN_PROGRESS to PENDING', () => expect(() => assertTransition(TicketStatus.IN_PROGRESS, TicketStatus.PENDING)).not.toThrow());
  it('allows REOPENED to PENDING', () => expect(() => assertTransition(TicketStatus.REOPENED, TicketStatus.PENDING)).not.toThrow());

  // Phase 2: transitions OUT OF PENDING (resume paths)
  it('allows PENDING to RESPONDED', () => expect(() => assertTransition(TicketStatus.PENDING, TicketStatus.RESPONDED)).not.toThrow());
  it('allows PENDING to ASSIGNED', () => expect(() => assertTransition(TicketStatus.PENDING, TicketStatus.ASSIGNED)).not.toThrow());
  it('allows PENDING to CANCELLED', () => expect(() => assertTransition(TicketStatus.PENDING, TicketStatus.CANCELLED)).not.toThrow());

  // Phase 2: invalid transitions to/from PENDING
  it('rejects RESOLVED to PENDING', () => expect(() => assertTransition(TicketStatus.RESOLVED, TicketStatus.PENDING)).toThrow());
  it('rejects CLOSED to PENDING', () => expect(() => assertTransition(TicketStatus.CLOSED, TicketStatus.PENDING)).toThrow());
  it('rejects CANCELLED to PENDING', () => expect(() => assertTransition(TicketStatus.CANCELLED, TicketStatus.PENDING)).toThrow());
  it('rejects PENDING to IN_PROGRESS directly', () => expect(() => assertTransition(TicketStatus.PENDING, TicketStatus.IN_PROGRESS)).toThrow());
  it('rejects PENDING to RESOLVED directly', () => expect(() => assertTransition(TicketStatus.PENDING, TicketStatus.RESOLVED)).toThrow());
});
