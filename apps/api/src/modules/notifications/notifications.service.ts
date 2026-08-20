import { Injectable } from '@nestjs/common';
import {
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface NotificationInput {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  uniqueEventKey: string;
  relatedType?: string;
  relatedId?: string;
}

interface RoleNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  eventKey: string;
  relatedType?: string;
  relatedId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  async createUnique(
    input: NotificationInput,
    tx?: Prisma.TransactionClient,
  ) {
    const db =
      tx ?? this.prisma;

    return db.notification.upsert({
      where: {
        uniqueEventKey:
          input.uniqueEventKey,
      },

      update: {},

      create: input,
    });
  }

  async notifyRoles(
    roleNames: string[],
    input: RoleNotificationInput,
    tx?: Prisma.TransactionClient,
  ) {
    const db =
      tx ?? this.prisma;

    const users =
      await db.user.findMany({
        where: {
          status:
            'APPROVED',

          roles: {
            some: {
              role: {
                name: {
                  in: roleNames,
                },
              },
            },
          },
        },

        select: {
          id: true,
        },
      });

    await Promise.all(
      users.map(
        (user) =>
          this.createUnique(
            {
              recipientUserId:
                user.id,

              type:
                input.type,

              title:
                input.title,

              body:
                input.body,

              relatedType:
                input.relatedType,

              relatedId:
                input.relatedId,

              uniqueEventKey:
                `${input.eventKey}-${user.id}`,
            },

            tx,
          ),
      ),
    );
  }

  async listForUser(
    userId: string,
    unreadOnly = false,
  ) {
    const notifications =
      await this.prisma.notification.findMany({
        where: {
          recipientUserId:
            userId,

          ...(unreadOnly
            ? {
              readAt: null,
            }
            : {}),
        },

        orderBy: {
          createdAt: 'desc',
        },

        take: 100,
      });

    /*
     * Assignment notification lama maupun baru
     * menggunakan:
     *
     * relatedType = assignment_member
     * relatedId   = assignmentMember.id
     *
     * Phase 9 mensyaratkan notifikasi assignment
     * tetap membuka detail ticket.
     *
     * Kita resolve seluruh assignmentMember
     * dalam SATU query agar tidak terjadi N+1.
     */
    const assignmentMemberIds = [
      ...new Set(
        notifications
          .filter(
            (notification) =>
              notification.relatedType ===
              'assignment_member' &&
              Boolean(
                notification.relatedId,
              ),
          )
          .map(
            (notification) =>
              notification.relatedId as string,
          ),
      ),
    ];

    const assignmentMembers =
      assignmentMemberIds.length
        ? await this.prisma.assignmentMember.findMany({
          where: {
            id: {
              in: assignmentMemberIds,
            },
          },

          select: {
            id: true,

            assignment: {
              select: {
                ticketId: true,
              },
            },
          },
        })
        : [];

    const ticketIdByAssignmentMember =
      new Map<string, string>();

    for (
      const member of
      assignmentMembers
    ) {
      ticketIdByAssignmentMember.set(
        member.id,
        member.assignment.ticketId,
      );
    }

    return notifications.map(
      (notification) => ({
        ...notification,

        /*
         * targetUrl merupakan API projection.
         *
         * Tidak perlu menambah column baru
         * pada database.
         */
        targetUrl:
          this.resolveTargetUrl(
            notification.relatedType,
            notification.relatedId,
            ticketIdByAssignmentMember,
          ),
      }),
    );
  }

  async unreadCount(
    userId: string,
  ) {
    const count =
      await this.prisma.notification.count({
        where: {
          recipientUserId:
            userId,

          readAt:
            null,
        },
      });

    return {
      count,
    };
  }

  async markRead(
    userId: string,
    notificationId: string,
  ) {
    return this.prisma.notification.updateMany({
      where: {
        id:
          notificationId,

        recipientUserId:
          userId,

        /*
         * Jangan mengganti timestamp readAt
         * jika notification sudah pernah dibaca.
         */
        readAt:
          null,
      },

      data: {
        readAt:
          new Date(),
      },
    });
  }

  async markAllRead(
    userId: string,
  ) {
    return this.prisma.notification.updateMany({
      where: {
        recipientUserId:
          userId,

        readAt:
          null,
      },

      data: {
        readAt:
          new Date(),
      },
    });
  }

  private resolveTargetUrl(
    relatedType: string | null,
    relatedId: string | null,
    ticketIdByAssignmentMember:
      Map<string, string>,
  ): string | null {
    if (!relatedId) {
      return null;
    }

    /*
     * Ticket notification:
     *
     * - TICKET_NEW
     * - SLA_RESPOND_WARNING
     * - SLA_RESPOND_BREACHED
     * - TECHNICIAN_CHECKIN
     * - TECHNICIAN_COMPLETED
     * - TICKET_RESOLVED
     * - TICKET_CLOSED
     * - TICKET_REOPENED
     */
    if (
      relatedType === 'ticket'
    ) {
      return `/app/tickets/${relatedId}`;
    }

    /*
     * Assignment-related notification:
     *
     * - ASSIGNMENT_NEW
     * - SLA_WORK_WARNING
     * - SLA_WORK_BREACHED
     *
     * Semua tetap diarahkan ke ticket detail.
     */
    if (
      relatedType ===
      'assignment_member'
    ) {
      const ticketId =
        ticketIdByAssignmentMember.get(
          relatedId,
        );

      return ticketId
        ? `/app/tickets/${ticketId}`
        : null;
    }

    /*
     * Notification non-ticket seperti
     * TECHNICIAN_APPROVED / TECHNICIAN_REJECTED
     * belum memiliki detail route yang relevan.
     */
    return null;
  }
}