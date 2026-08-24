import { ConflictException, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationType, Prisma, SlaEventType, SlaOutcome, SlaStatus, SlaType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { addSeconds, evaluateSla } from '../../common/utils/sla';
import { NotificationsService } from '../notifications/notifications.service';

const ACTIVE_SLA_STATUSES: SlaStatus[] = [
  SlaStatus.OPEN,
  SlaStatus.WARNING,
  SlaStatus.BREACHED,
];

@Injectable()
export class SlaService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) { }
  async policyAt(
    priorityId: string,
    effectiveAt: Date,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;

    return db.slaPolicyVersion.findFirstOrThrow({
      where: {
        priorityId,
        effectiveFrom: {
          lte: effectiveAt,
        },
      },
      orderBy: [
        { version: 'desc' },
        { effectiveFrom: 'desc' },
      ],
      include: {
        priority: true,
      },
    });
  }

  async activePolicy(priorityId: string, tx?: Prisma.TransactionClient) {
    return this.policyAt(
      priorityId,
      new Date(),
      tx,
    );
  }

  async createRespond(ticket: { id: string; createdAt: Date; serviceCycleNo: number; priorityId: string }, tx: Prisma.TransactionClient) {
    const policy = await this.activePolicy(ticket.priorityId, tx);
    const warningAt = addSeconds(ticket.createdAt, Math.floor(policy.respondTargetSeconds * policy.warningThresholdPercent / 100));
    const dueAt = addSeconds(ticket.createdAt, policy.respondTargetSeconds);
    return tx.slaInstance.create({
      data: {
        slaType: SlaType.RESPOND, ticketId: ticket.id, serviceCycleNo: ticket.serviceCycleNo,
        policyVersionId: policy.id, prioritySnapshot: policy.priority.code,
        targetSeconds: policy.respondTargetSeconds, warningThresholdPercent: policy.warningThresholdPercent,
        startedAt: ticket.createdAt, warningAt, dueAt,
        events: { create: { type: SlaEventType.STARTED } }
      }
    });
  }

  async createWork(
    member: {
      id: string;
      assignedAt: Date;
    },
    ticket: {
      serviceCycleNo: number;
      priorityId: string;
    },
    startedAt: Date,
    tx: Prisma.TransactionClient,
  ) {
    const policy = await this.policyAt(
      ticket.priorityId,
      member.assignedAt,
      tx,
    );

    const warningAt = addSeconds(
      startedAt,
      Math.floor(policy.workTargetSeconds * policy.warningThresholdPercent / 100,),
    );

    const dueAt = addSeconds(
      startedAt,
      policy.workTargetSeconds,
    );

    const lifecycle = {
      serviceCycleNo: ticket.serviceCycleNo,
      policyVersionId: policy.id,
      prioritySnapshot: policy.priority.code,
      targetSeconds: policy.workTargetSeconds,
      warningThresholdPercent: policy.warningThresholdPercent,
      startedAt,
      warningAt,
      dueAt,
    };

    /*
     * Upsert menjaga kompatibilitas dengan data lama yang membuat
     * WORK SLA saat assignment. Saat check-in pertama, lifecycle lama
     * tersebut dimulai ulang dari waktu check-in yang sebenarnya.
     *
     * Compound unique key juga membuat operasi ini aman terhadap
     * race tanpa pola find-then-create.
     */
    return tx.slaInstance.upsert({
      where: {
        slaType_assignmentMemberId: {
          slaType: SlaType.WORK,
          assignmentMemberId: member.id,
        },
      },
      create: {
        slaType: SlaType.WORK,
        assignmentMemberId: member.id,
        ...lifecycle,
        events: { create: { type: SlaEventType.STARTED } },
      },
      update: {
        ...lifecycle,
        completedAt: null,
        endedAt: null,
        status: SlaStatus.OPEN,
        outcome: null,
        breachedAt: null,
        breachSeconds: 0,
        events: {
          create: {
            type: SlaEventType.RECALCULATED,
            metadata: {
              reason: 'WORK_STARTED_AT_CHECKIN',
            },
          },
        },
      },
    });
  }

  async complete(
    instanceId: string,
    completedAt: Date,
    tx: Prisma.TransactionClient,
  ) {
    const instance =
      await tx.slaInstance.findUniqueOrThrow({
        where: {
          id:
            instanceId,
        },
      });

    /*
     * SLA yang sudah terminal tidak boleh diselesaikan ulang.
     *
     * Ini mencegah CANCELLED/REASSIGNED/REMOVED SLA
     * berubah menjadi MET atau COMPLETED_BREACHED.
     */
    if (
      instance.completedAt ||
      instance.endedAt ||
      !ACTIVE_SLA_STATUSES.includes(
        instance.status,
      )
    ) {
      throw new ConflictException({
        code:
          'SLA_NOT_ACTIVE',

        message:
          'SLA sudah berakhir dan tidak dapat diselesaikan kembali.',

        details: {
          slaInstanceId:
            instance.id,

          status:
            instance.status,

          outcome:
            instance.outcome,
        },
      });
    }

    const outcome =
      completedAt <=
        instance.dueAt
        ? SlaOutcome.MET
        : SlaOutcome.COMPLETED_BREACHED;

    const breachSeconds =
      Math.max(
        0,

        Math.floor(
          (
            completedAt.getTime() -
            instance.dueAt.getTime()
          ) /
          1000,
        ),
      );

    /*
     * Conditional update berfungsi sebagai compare-and-set.
     *
     * Jika SLA berubah menjadi ENDED di antara read dan update,
     * update ini menghasilkan count = 0 dan tidak akan menimpa
     * terminal outcome tersebut.
     */
    const updateResult =
      await tx.slaInstance.updateMany({
        where: {
          id:
            instance.id,

          completedAt:
            null,

          endedAt:
            null,

          status: {
            in:
              ACTIVE_SLA_STATUSES,
          },
        },

        data: {
          completedAt,

          status:
            SlaStatus.COMPLETED,

          outcome,

          breachSeconds,

          breachedAt:
            outcome ===
              SlaOutcome.COMPLETED_BREACHED
              ? (
                instance.breachedAt ??
                instance.dueAt
              )
              : null,
        },
      });

    if (
      updateResult.count !==
      1
    ) {
      throw new ConflictException({
        code:
          'SLA_NOT_ACTIVE',

        message:
          'SLA sudah berubah atau berakhir sebelum completion diproses.',

        details: {
          slaInstanceId:
            instance.id,
        },
      });
    }

    await tx.slaEvent.create({
      data: {
        slaInstanceId:
          instance.id,

        type:
          SlaEventType.COMPLETED,

        metadata: {
          outcome,
          breachSeconds,
        },
      },
    });

    return tx.slaInstance.findUniqueOrThrow({
      where: {
        id:
          instance.id,
      },
    });
  }

  async end(
    instanceId: string,
    endedAt: Date,
    outcome: SlaOutcome,
    tx: Prisma.TransactionClient,
  ) {
    const instance =
      await tx.slaInstance.findUniqueOrThrow({
        where: {
          id:
            instanceId,
        },
      });

    /*
     * end() dibuat idempotent terhadap terminal SLA.
     *
     * Contoh:
     * - completion menang race lebih dulu;
     * - kemudian cancel mencoba meng-end SLA yang sama.
     *
     * Completion yang sah tidak boleh ditimpa menjadi CANCELLED.
     */
    if (
      instance.completedAt ||
      instance.endedAt ||
      !ACTIVE_SLA_STATUSES.includes(
        instance.status,
      )
    ) {
      return instance;
    }

    const breachSeconds =
      Math.max(
        0,

        Math.floor(
          (
            endedAt.getTime() -
            instance.dueAt.getTime()
          ) /
          1000,
        ),
      );

    /*
     * Compare-and-set untuk mencegah concurrent update
     * menimpa terminal SLA.
     */
    const updateResult =
      await tx.slaInstance.updateMany({
        where: {
          id:
            instance.id,

          completedAt:
            null,

          endedAt:
            null,

          status: {
            in:
              ACTIVE_SLA_STATUSES,
          },
        },

        data: {
          endedAt,

          status:
            SlaStatus.ENDED,

          outcome,

          breachSeconds,
        },
      });

    /*
     * SLA mungkin diselesaikan oleh transaction lain tepat
     * sebelum update ini mendapatkan lock.
     *
     * Jangan overwrite state tersebut.
     */
    if (
      updateResult.count ===
      0
    ) {
      return tx.slaInstance.findUniqueOrThrow({
        where: {
          id:
            instance.id,
        },
      });
    }

    await tx.slaEvent.create({
      data: {
        slaInstanceId:
          instance.id,

        type:
          SlaEventType.ENDED,

        metadata: {
          outcome,
        },
      },
    });

    return tx.slaInstance.findUniqueOrThrow({
      where: {
        id:
          instance.id,
      },
    });
  }

  present<T extends { startedAt: Date; warningAt: Date; dueAt: Date; completedAt: Date | null; endedAt: Date | null; outcome: SlaOutcome | null }>(instance: T) {
    return { ...instance, runtime: evaluateSla(instance) };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async evaluateOpenInstances(): Promise<void> {
    const now = new Date();
    const instances = await this.prisma.slaInstance.findMany({
      where: { status: { in: ACTIVE_SLA_STATUSES }, completedAt: null, endedAt: null },
      include: {
        ticket: { select: { id: true, ticketCode: true } },
        assignmentMember: { include: { technician: { select: { id: true } }, assignment: { include: { ticket: { select: { id: true, ticketCode: true } } } } } }
      }
    });
    for (const instance of instances) {
      const runtime = evaluateSla({ ...instance, now });
      if (runtime.status === instance.status) continue;
      await this.prisma.$transaction(async (tx) => {
        await tx.slaInstance.update({
          where: { id: instance.id },
          data: {
            status: runtime.status,
            breachedAt: runtime.status === SlaStatus.BREACHED ? instance.breachedAt ?? instance.dueAt : instance.breachedAt,
            breachSeconds: runtime.breachSeconds,
            events: { create: { type: runtime.status === SlaStatus.WARNING ? SlaEventType.WARNING : SlaEventType.BREACHED } }
          }
        });
        if (instance.slaType === SlaType.RESPOND && instance.ticket) {
          await this.notifications.notifyRoles(['ADMINISTRATOR', 'HEAD'], {
            type: runtime.status === SlaStatus.WARNING ? NotificationType.SLA_RESPOND_WARNING : NotificationType.SLA_RESPOND_BREACHED,
            title: runtime.status === SlaStatus.WARNING ? 'SLA Respond mendekati batas' : 'SLA Respond terlewati',
            body: `Ticket ${instance.ticket.ticketCode} memerlukan respons.`,
            relatedType: 'ticket', relatedId: instance.ticket.id, eventKey: `sla-${instance.id}-${runtime.status}`
          }, tx);
        }
        if (instance.slaType === SlaType.WORK && instance.assignmentMember) {
          await this.notifications.createUnique({
            recipientUserId: instance.assignmentMember.technician.id,
            type: runtime.status === SlaStatus.WARNING ? NotificationType.SLA_WORK_WARNING : NotificationType.SLA_WORK_BREACHED,
            title: runtime.status === SlaStatus.WARNING ? 'SLA pekerjaan mendekati batas' : 'SLA pekerjaan terlewati',
            body: `Assignment ${instance.assignmentMember.assignment.ticket.ticketCode} memerlukan tindakan.`,
            relatedType: 'assignment_member', relatedId: instance.assignmentMember.id,
            uniqueEventKey: `sla-${instance.id}-${runtime.status}-${instance.assignmentMember.technician.id}`
          }, tx);
        }
      });
    }
  }
}
