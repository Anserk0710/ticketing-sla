import { ConflictException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

const transitions:
  Record<
    TicketStatus,
    TicketStatus[]
  > = {
  NEW: [
    TicketStatus.RESPONDED,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING,
  ],

  RESPONDED: [
    TicketStatus.ASSIGNED,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING,
  ],

  ASSIGNED: [
    TicketStatus.ON_SITE,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING,
  ],

  ON_SITE: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING,
  ],

  IN_PROGRESS: [
    TicketStatus.RESOLVED,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING,
  ],

  RESOLVED: [
    TicketStatus.CLOSED,
    TicketStatus.REOPENED,
  ],

  CLOSED: [
    TicketStatus.REOPENED,
  ],

  /*
   * Historical only.
   */
  REJECTED: [],

  REOPENED: [
    TicketStatus.ASSIGNED,
    TicketStatus.IN_PROGRESS,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING,
  ],

  CANCELLED: [],

  PENDING: [
    TicketStatus.RESPONDED,
    TicketStatus.ASSIGNED,
    TicketStatus.CANCELLED,
  ],
};

/*
 * Reassign bukan ticket state transition.
 *
 * Ticket mempertahankan operational state saat ini.
 */
const REASSIGNABLE_STATUSES =
  new Set<TicketStatus>([
    TicketStatus.ASSIGNED,
    TicketStatus.ON_SITE,
    TicketStatus.IN_PROGRESS,
  ]);

/*
 * Status ticket tempat action technician boleh berjalan.
 *
 * Penting untuk multi-technician:
 *
 * Technician A mungkin sudah membuat ticket ON_SITE /
 * IN_PROGRESS sementara Technician B masih ASSIGNED
 * dan belum Accept.
 *
 * Karena itu Accept/Check-in member B tetap harus
 * diperbolehkan selama ticket masih operational.
 */
const TECHNICIAN_OPERATIONAL_STATUSES =
  new Set<TicketStatus>([
    TicketStatus.ASSIGNED,
    TicketStatus.ON_SITE,
    TicketStatus.IN_PROGRESS,
  ]);

export function assertTransition(
  from: TicketStatus,
  to: TicketStatus,
): void {
  if (
    !transitions[
      from
    ].includes(
      to,
    )
  ) {
    throw new ConflictException({
      code:
        'INVALID_TICKET_TRANSITION',

      message:
        `Ticket tidak dapat berpindah dari ${from} ke ${to}.`,

      details: {
        from,
        to,
      },
    });
  }
}

export function assertReassignAllowed(
  status: TicketStatus,
): void {
  if (
    status ===
    TicketStatus.PENDING
  ) {
    throw new ConflictException({
      code:
        'TICKET_PENDING_RESUME_REQUIRED',

      message:
        'Ticket sedang pending/reschedule. Lanjutkan ticket terlebih dahulu sebelum melakukan reassign.',

      details: {
        status,
      },
    });
  }

  if (
    !REASSIGNABLE_STATUSES.has(
      status,
    )
  ) {
    throw new ConflictException({
      code:
        'INVALID_REASSIGN_STATE',

      message:
        `Ticket dengan status ${status} tidak dapat di-reassign.`,

      details: {
        status,

        allowedStatuses: [
          TicketStatus.ASSIGNED,
          TicketStatus.ON_SITE,
          TicketStatus.IN_PROGRESS,
        ],
      },
    });
  }
}

/*
 * Shared guard untuk seluruh action technician:
 *
 * - Accept
 * - Check-in
 * - Start Work
 * - Complete
 *
 * Gunakan whitelist, bukan blacklist.
 */
export function assertTechnicianOperational(
  status: TicketStatus,
): void {
  if (
    status ===
    TicketStatus.PENDING
  ) {
    throw new ConflictException({
      code:
        'TICKET_PENDING',

      message:
        'Ticket sedang pending/reschedule. Tunggu Head atau Administrator melanjutkan ticket.',

      details: {
        status,
      },
    });
  }

  if (
    !TECHNICIAN_OPERATIONAL_STATUSES.has(
      status,
    )
  ) {
    throw new ConflictException({
      code:
        'TICKET_NOT_OPERATIONAL',

      message:
        `Aktivitas teknisi tidak dapat dilakukan karena ticket berstatus ${status}.`,

      details: {
        status,

        allowedStatuses: [
          TicketStatus.ASSIGNED,
          TicketStatus.ON_SITE,
          TicketStatus.IN_PROGRESS,
        ],
      },
    });
  }
}