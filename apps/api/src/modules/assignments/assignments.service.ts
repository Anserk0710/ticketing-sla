import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AssignmentMemberStatus,
  AssignmentStatus,
  NotificationType,
  SlaOutcome,
  TicketStatus,
  UserStatus,
} from '@prisma/client';

import {
  AuthUser,
} from '../../common/types/auth-user';

import {
  PrismaService,
} from '../../database/prisma.service';

import {
  AuditService,
} from '../audit/audit.service';

import {
  NotificationsService,
} from '../notifications/notifications.service';

import {
  SlaService,
} from '../sla/sla.service';

import {
  assertReassignAllowed,
  assertTechnicianOperational,
  assertTransition,
} from '../tickets/ticket-state-machine';

import {
  CreateAssignmentDto,
  ReassignDto,
  UpdateMemberDto,
} from './assignments.dto';

const NON_REASSIGNABLE_TICKET_STATUSES =
  new Set<TicketStatus>([
    TicketStatus.CANCELLED,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
    TicketStatus.REJECTED,
  ]);

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly sla:
      SlaService,

    private readonly notifications:
      NotificationsService,

    private readonly audit:
      AuditService,
  ) { }

  async create(
    ticketId: string,
    dto: CreateAssignmentDto,
    actor: AuthUser,
  ) {
    const uniqueIds = [
      ...new Set(
        dto.technicianIds,
      ),
    ];

    if (
      !uniqueIds.includes(
        dto.leadTechnicianId,
      )
    ) {
      throw new ConflictException({
        code:
          'LEAD_NOT_MEMBER',

        message:
          'Lead technician harus termasuk dalam anggota assignment.',
      });
    }

    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const ticket =
            await tx.ticket.findUniqueOrThrow({
              where: {
                id: ticketId,
              },
            });

          if (
            ticket.status !==
            TicketStatus.RESPONDED &&
            ticket.status !==
            TicketStatus.REOPENED
          ) {
            throw new ConflictException({
              code:
                'INVALID_ASSIGNMENT_STATE',

              message:
                'Ticket harus sudah direspons atau dibuka kembali sebelum assignment.',
            });
          }

          const technicians =
            await tx.user.findMany({
              where: {
                id: {
                  in: uniqueIds,
                },

                status:
                  UserStatus.APPROVED,

                roles: {
                  some: {
                    role: {
                      name:
                        'TECHNICIAN',
                    },
                  },
                },
              },

              select: {
                id: true,
              },
            });

          if (
            technicians.length !==
            uniqueIds.length
          ) {
            throw new ConflictException({
              code:
                'TECHNICIAN_INVALID',

              message:
                'Satu atau lebih teknisi tidak aktif atau tidak valid.',
            });
          }

          const now =
            new Date();

          const assignment =
            await tx.ticketAssignment.create({
              data: {
                ticketId,

                serviceCycleNo:
                  ticket.serviceCycleNo,

                assignedById:
                  actor.id,

                assignedAt:
                  now,

                note:
                  dto.note,
              },
            });

          for (
            const technicianId of
            uniqueIds
          ) {
            const member =
              await tx.assignmentMember.create({
                data: {
                  assignmentId:
                    assignment.id,

                  technicianId,

                  isLead:
                    technicianId ===
                    dto.leadTechnicianId,

                  assignedAt:
                    now,
                },
              });

            /*
             * WORK SLA tidak dibuat saat assignment.
             *
             * Assignment hanya membentuk lifecycle penugasan.
             * WORK SLA baru akan dibuat setelah technician
             * berhasil melakukan check-in.
             */
            await this.notifications.createUnique(
              {
                recipientUserId:
                  technicianId,

                type:
                  NotificationType.ASSIGNMENT_NEW,

                title:
                  'Assignment baru',

                body:
                  `Anda ditugaskan pada ${ticket.ticketCode}.`,

                relatedType:
                  'assignment_member',

                relatedId:
                  member.id,

                uniqueEventKey:
                  `assignment-new-${member.id}`,
              },

              tx,
            );
          }

          assertTransition(
            ticket.status,
            TicketStatus.ASSIGNED,
          );

          await tx.ticket.update({
            where: {
              id: ticketId,
            },

            data: {
              status:
                TicketStatus.ASSIGNED,

              version: {
                increment: 1,
              },
            },
          });

          await tx.ticketStatusLog.create({
            data: {
              ticketId,

              fromStatus:
                ticket.status,

              toStatus:
                TicketStatus.ASSIGNED,

              actorId:
                actor.id,

              metadata: {
                assignmentId:
                  assignment.id,

                memberCount:
                  uniqueIds.length,
              },
            },
          });

          return assignment;
        },
      );

    await this.audit.write({
      actorUserId:
        actor.id,

      action:
        'TICKET_ASSIGNED',

      resourceType:
        'ticket_assignment',

      resourceId:
        result.id,

      after: {
        ticketId,

        technicianIds:
          uniqueIds,

        leadTechnicianId:
          dto.leadTechnicianId,
      },
    });

    return this.detail(
      result.id,
      actor,
    );
  }

  async history(
    ticketId: string,
    user: AuthUser,
  ) {
    if (
      !user.permissions.includes(
        'ticket.read.all',
      )
    ) {
      const member =
        await this.prisma.assignmentMember.count({
          where: {
            technicianId:
              user.id,

            assignment: {
              ticketId,
            },
          },
        });

      if (
        !member
      ) {
        throw new ForbiddenException({
          code:
            'ASSIGNMENT_ACCESS_DENIED',

          message:
            'Assignment tidak dapat diakses.',
        });
      }
    }

    return this.prisma.ticketAssignment.findMany({
      where: {
        ticketId,
      },

      include: {
        assignedBy: {
          select: {
            id: true,
            displayName:
              true,
          },
        },

        members: {
          include: {
            technician: {
              select: {
                id: true,
                displayName:
                  true,
                email:
                  true,
              },
            },

            slaInstances:
              true,
          },
        },
      },

      orderBy: {
        assignedAt:
          'asc',
      },
    });
  }

  async reassign(
    assignmentId: string,
    dto: ReassignDto,
    actor: AuthUser,
  ) {
    const uniqueIds = [
      ...new Set(
        dto.technicianIds,
      ),
    ];

    if (
      !uniqueIds.includes(
        dto.leadTechnicianId,
      )
    ) {
      throw new ConflictException({
        code:
          'LEAD_NOT_MEMBER',

        message:
          'Lead technician harus termasuk anggota.',
      });
    }

    const result =
      await this.prisma.$transaction(
        async (tx) => {
          /*
           * Read seluruh state yang diperlukan sebelum
           * melakukan side effect.
           */
          const old =
            await tx.ticketAssignment.findUnique({
              where: {
                id:
                  assignmentId,
              },

              include: {
                ticket:
                  true,

                members: {
                  include: {
                    slaInstances: {
                      where: {
                        slaType:
                          'WORK',
                      },
                    },
                  },
                },
              },
            });

          if (
            !old
          ) {
            throw new NotFoundException({
              code:
                'ASSIGNMENT_NOT_FOUND',

              message:
                'Assignment tidak ditemukan.',
            });
          }

          /*
           * Assignment yang sudah berakhir tidak boleh
           * menjadi sumber reassignment baru.
           */
          if (
            old.status !==
            AssignmentStatus.ACTIVE ||
            old.endedAt
          ) {
            throw new ConflictException({
              code:
                'ASSIGNMENT_ENDED',

              message:
                'Assignment sudah berakhir.',
            });
          }

          /*
           * IMPORTANT:
           *
           * Validasi ticket dilakukan SEBELUM:
           *
           * - mengakhiri assignment;
           * - mengubah member;
           * - mengakhiri SLA;
           * - membuat assignment baru;
           * - membuat SLA baru.
           *
           * PENDING akan ditolak di sini.
           * CANCELLED/RESOLVED/CLOSED/REJECTED dan state
           * non-operational lainnya juga ditolak.
           */
          assertReassignAllowed(
            old.ticket.status,
          );

          /*
           * Pastikan seluruh teknisi baru masih valid.
           *
           * Query ini tidak mempunyai side effect sehingga
           * aman dilakukan sebelum concurrency lock.
           */
          const technicians =
            await tx.user.findMany({
              where: {
                id: {
                  in:
                    uniqueIds,
                },

                status:
                  UserStatus.APPROVED,

                roles: {
                  some: {
                    role: {
                      name:
                        'TECHNICIAN',
                    },
                  },
                },
              },

              select: {
                id:
                  true,
              },
            });

          if (
            technicians.length !==
            uniqueIds.length
          ) {
            throw new ConflictException({
              code:
                'TECHNICIAN_INVALID',

              message:
                'Teknisi pengganti tidak valid.',
            });
          }

          const now =
            new Date();

          /*
           * ------------------------------------------------------------------
           * OPTIMISTIC CONCURRENCY GUARD — TICKET
           * ------------------------------------------------------------------
           *
           * Reassign sendiri tidak mengubah status ticket.
           *
           * Namun kita tetap melakukan compare-and-set berdasarkan:
           *
           * - id
           * - status yang baru saja dibaca
           * - version yang baru saja dibaca
           *
           * Tujuannya:
           *
           * Jika antara findUnique() dan titik ini ada request lain
           * yang melakukan:
           *
           *   reschedule
           *   cancel
           *   resume
           *   atau perubahan ticket lain
           *
           * maka operation reassign harus dibatalkan.
           *
           * Increment version juga menandai bahwa assignment lifecycle
           * ticket telah berubah.
           */
          const ticketGuard =
            await tx.ticket.updateMany({
              where: {
                id:
                  old.ticketId,

                status:
                  old.ticket.status,

                version:
                  old.ticket.version,
              },

              data: {
                version: {
                  increment:
                    1,
                },
              },
            });

          if (
            ticketGuard.count !==
            1
          ) {
            throw new ConflictException({
              code:
                'TICKET_STATE_CHANGED',

              message:
                'Status ticket berubah saat proses reassign. Muat ulang data ticket dan ulangi operasi.',

              details: {
                ticketId:
                  old.ticketId,

                expectedStatus:
                  old.ticket.status,

                expectedVersion:
                  old.ticket.version,
              },
            });
          }

          /*
           * ------------------------------------------------------------------
           * OPTIMISTIC CONCURRENCY GUARD — ASSIGNMENT
           * ------------------------------------------------------------------
           *
           * Jangan gunakan update({ id }) saja.
           *
           * Dua request reassign yang masuk hampir bersamaan bisa
           * membaca assignment yang sama-sama ACTIVE.
           *
           * updateMany dengan kondisi ACTIVE + endedAt null
           * bertindak sebagai compare-and-set:
           *
           * hanya satu transaction yang boleh mengakhiri assignment.
           */
          const assignmentGuard =
            await tx.ticketAssignment.updateMany({
              where: {
                id:
                  old.id,

                status:
                  AssignmentStatus.ACTIVE,

                endedAt:
                  null,
              },

              data: {
                status:
                  AssignmentStatus.ENDED,

                endedAt:
                  now,
              },
            });

          if (
            assignmentGuard.count !==
            1
          ) {
            throw new ConflictException({
              code:
                'ASSIGNMENT_STATE_CHANGED',

              message:
                'Assignment telah berubah atau sudah di-reassign oleh proses lain.',

              details: {
                assignmentId:
                  old.id,
              },
            });
          }

          /*
           * Tutup lifecycle seluruh member lama yang masih aktif.
           *
           * Untuk member yang sudah COMPLETED:
           *
           * - pertahankan COMPLETED;
           * - hanya isi endedAt.
           *
           * Untuk member yang belum complete:
           *
           * - status -> REASSIGNED;
           * - endedAt -> now;
           * - SLA aktif -> REASSIGNED.
           */
          for (
            const member of
            old.members.filter(
              (item) =>
                !item.endedAt,
            )
          ) {
            const isCompleted =
              member.status ===
              AssignmentMemberStatus.COMPLETED;

            await tx.assignmentMember.update({
              where: {
                id:
                  member.id,
              },

              data: {
                /*
                 * Jangan ubah histori member yang memang
                 * sudah menyelesaikan pekerjaannya.
                 */
                ...(
                  isCompleted
                    ? {}
                    : {
                      status:
                        AssignmentMemberStatus.REASSIGNED,
                    }
                ),

                endedAt:
                  now,
              },
            });

            /*
             * SLA member yang belum selesai diakhiri karena
             * reassignment — bukan karena PENDING.
             *
             * Karena reassign pada PENDING sudah ditolak di atas,
             * reschedule tidak lagi dapat digunakan untuk
             * memutus dan membuat ulang SLA Work.
             */
            if (
              !isCompleted
            ) {
              const activeWorkSla =
                member.slaInstances.find(
                  (instance) =>
                    !instance.completedAt &&
                    !instance.endedAt,
                );

              if (
                activeWorkSla
              ) {
                await this.sla.end(
                  activeWorkSla.id,
                  now,
                  SlaOutcome.REASSIGNED,
                  tx,
                );
              }
            }
          }

          /*
           * Buat assignment pengganti.
           *
           * Ticket status TIDAK diubah di sini.
           */
          const next =
            await tx.ticketAssignment.create({
              data: {
                ticketId:
                  old.ticketId,

                serviceCycleNo:
                  old.ticket.serviceCycleNo,

                assignedById:
                  actor.id,

                assignedAt:
                  now,

                note:
                  `${dto.reason}${dto.note
                    ? ` — ${dto.note}`
                    : ''
                  }`,
              },
            });

          for (
            const technicianId of
            uniqueIds
          ) {
            const member =
              await tx.assignmentMember.create({
                data: {
                  assignmentId:
                    next.id,

                  technicianId,

                  isLead:
                    technicianId ===
                    dto.leadTechnicianId,

                  assignedAt:
                    now,
                },
              });

            /*
             * WORK SLA sengaja belum dibuat di sini.
             *
             * Assignment/reassignment hanya membentuk lifecycle
             * penugasan. WORK SLA baru akan dimulai setelah
             * technician berhasil check-in.
             */
            await this.notifications.createUnique(
              {
                recipientUserId:
                  technicianId,

                type:
                  NotificationType.ASSIGNMENT_NEW,

                title:
                  'Assignment pengganti',

                body:
                  `Anda ditugaskan pada ${old.ticket.ticketCode}.`,

                relatedType:
                  'assignment_member',

                relatedId:
                  member.id,

                uniqueEventKey:
                  `assignment-new-${member.id}`,
              },

              tx,
            );
          }

          /*
           * PENTING:
           *
           * HAPUS behavior lama:
           *
           *   ticket.status = ASSIGNED
           *
           * Reassign bukan ticket state transition.
           *
           * Ticket mempertahankan operational state:
           *
           * ASSIGNED    -> ASSIGNED
           * ON_SITE     -> ON_SITE
           * IN_PROGRESS -> IN_PROGRESS
           *
           * Karena tidak terjadi status transition,
           * kita juga TIDAK membuat TicketStatusLog palsu
           * dengan fromStatus/toStatus yang sama atau invalid.
           *
           * Histori reassignment tetap tersedia melalui:
           *
           * - TicketAssignment lama (ENDED)
           * - member lama (REASSIGNED)
           * - SLA outcome REASSIGNED
           * - TicketAssignment baru
           * - AuditLog ASSIGNMENT_REASSIGNED
           */
          return {
            assignment:
              next,

            ticketStatus:
              old.ticket.status,
          };
        },
      );

    await this.audit.write({
      actorUserId:
        actor.id,

      action:
        'ASSIGNMENT_REASSIGNED',

      resourceType:
        'ticket_assignment',

      resourceId:
        result.assignment.id,

      after: {
        replacedAssignmentId:
          assignmentId,

        reason:
          dto.reason,

        ticketStatus:
          result.ticketStatus,
      },
    });

    return this.detail(
      result.assignment.id,
      actor,
    );
  }

  async updateMember(
    assignmentId: string,
    memberId: string,
    dto: UpdateMemberDto,
    actor: AuthUser,
  ) {
    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const member =
            await tx.assignmentMember.findFirst({
              where: {
                id:
                  memberId,

                assignmentId,
              },
            });

          if (
            !member
          ) {
            throw new NotFoundException({
              code:
                'MEMBER_NOT_FOUND',

              message:
                'Anggota assignment tidak ditemukan.',
            });
          }

          if (
            dto.isLead ===
            true
          ) {
            await tx.assignmentMember.updateMany({
              where: {
                assignmentId,

                id: {
                  not:
                    memberId,
                },

                endedAt:
                  null,
              },

              data: {
                isLead:
                  false,
              },
            });
          }

          if (
            dto.isLead ===
            false &&
            member.isLead
          ) {
            const replacementLead =
              await tx.assignmentMember.findFirst({
                where: {
                  assignmentId,

                  id: {
                    not:
                      memberId,
                  },

                  endedAt:
                    null,

                  status: {
                    notIn: [
                      AssignmentMemberStatus.REMOVED,
                      AssignmentMemberStatus.REASSIGNED,
                      AssignmentMemberStatus.REJECTED,
                    ],
                  },
                },
              });

            if (
              !replacementLead
            ) {
              throw new ConflictException({
                code:
                  'LEAD_REQUIRED',

                message:
                  'Assignment aktif wajib memiliki lead technician.',
              });
            }

            await tx.assignmentMember.update({
              where: {
                id:
                  replacementLead.id,
              },

              data: {
                isLead:
                  true,
              },
            });
          }

          return tx.assignmentMember.update({
            where: {
              id:
                memberId,
            },

            data: {
              isLead:
                dto.isLead,

              requiredForResolution:
                dto.requiredForResolution,
            },
          });
        },
      );

    await this.audit.write({
      actorUserId:
        actor.id,

      action:
        'ASSIGNMENT_MEMBER_UPDATED',

      resourceType:
        'assignment_member',

      resourceId:
        memberId,

      after: {
        ...dto,
      },
    });

    return updated;
  }

  async removeMember(
    assignmentId: string,
    memberId: string,
    reason: string,
    actor: AuthUser,
  ) {
    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const member =
            await tx.assignmentMember.findFirst({
              where: {
                id:
                  memberId,

                assignmentId,
              },

              include: {
                slaInstances: {
                  where: {
                    slaType:
                      'WORK',
                  },
                },
              },
            });

          if (
            !member
          ) {
            throw new NotFoundException({
              code:
                'MEMBER_NOT_FOUND',

              message:
                'Anggota tidak ditemukan.',
            });
          }

          const now =
            new Date();

          const result =
            await tx.assignmentMember.update({
              where: {
                id:
                  memberId,
              },

              data: {
                status:
                  AssignmentMemberStatus.REMOVED,

                endedAt:
                  now,

                isLead:
                  false,
              },
            });

          if (
            member.isLead
          ) {
            const replacementLead =
              await tx.assignmentMember.findFirst({
                where: {
                  assignmentId,

                  id: {
                    not:
                      memberId,
                  },

                  endedAt:
                    null,

                  status: {
                    notIn: [
                      AssignmentMemberStatus.REMOVED,
                      AssignmentMemberStatus.REASSIGNED,
                      AssignmentMemberStatus.REJECTED,
                    ],
                  },
                },
              });

            if (
              replacementLead
            ) {
              await tx.assignmentMember.update({
                where: {
                  id:
                    replacementLead.id,
                },

                data: {
                  isLead:
                    true,
                },
              });
            }
          }

          const activeWorkSla =
            member.slaInstances.find(
              (instance) =>
                !instance.completedAt &&
                !instance.endedAt,
            );

          if (
            activeWorkSla
          ) {
            await this.sla.end(
              activeWorkSla.id,
              now,
              SlaOutcome.REMOVED,
              tx,
            );
          }

          return result;
        },
      );

    await this.audit.write({
      actorUserId:
        actor.id,

      action:
        'ASSIGNMENT_MEMBER_REMOVED',

      resourceType:
        'assignment_member',

      resourceId:
        memberId,

      after: {
        reason,
      },
    });

    return updated;
  }

  async myAssignments(
    user: AuthUser,
  ) {
    const items =
      await this.prisma.assignmentMember.findMany({
        where: {
          technicianId:
            user.id,
        },

        include: {
          assignment: {
            include: {
              ticket: {
                include: {
                  site: {
                    include: {
                      client:
                        true,
                    },
                  },

                  category:
                    true,

                  priority:
                    true,
                },
              },

              assignedBy: {
                select: {
                  displayName:
                    true,
                },
              },
            },
          },

          slaInstances:
            true,

          checkins: {
            orderBy: {
              serverReceivedAt:
                'desc',
            },

            take: 1,
          },

          workCompletions:
            true,
        },

        orderBy: {
          assignedAt:
            'desc',
        },
      });

    return items.map(
      (item) => ({
        ...item,

        sla:
          item
            .slaInstances[0]
            ? this.sla.present(
              item
                .slaInstances[0],
            )
            : null,
      }),
    );
  }

  async accept(
    memberId: string,
    user: AuthUser,
  ) {
    const member =
      await this.ownMember(
        memberId,
        user.id,
      );

    /*
     * Ticket harus masih berada dalam operational lifecycle.
     *
     * Jangan hanya menerima TicketStatus.ASSIGNED.
     *
     * Pada multi-technician:
     *
     * Technician A:
     * ACCEPTED -> Check-in
     *
     * Ticket:
     * ASSIGNED -> ON_SITE
     *
     * Technician B mungkin masih ASSIGNED dan tetap harus
     * bisa menerima assignment miliknya.
     */
    assertTechnicianOperational(
      member.assignment
        .ticket.status,
    );

    if (
      member.status !==
      AssignmentMemberStatus.ASSIGNED
    ) {
      throw new ConflictException({
        code:
          'ASSIGNMENT_CANNOT_ACCEPT',

        message:
          'Assignment hanya dapat diterima ketika status teknisi masih ASSIGNED.',

        details: {
          memberStatus:
            member.status,

          ticketStatus:
            member.assignment
              .ticket.status,
        },
      });
    }

    const now =
      new Date();

    /*
     * Compare-and-set.
     *
     * Mencegah dua request Accept bersamaan sama-sama
     * mengubah acceptedAt.
     *
     * Parent assignment dan ticket juga kembali diverifikasi
     * pada saat UPDATE dilakukan.
     */
    const updated =
      await this.prisma.assignmentMember.updateMany({
        where: {
          id:
            member.id,

          technicianId:
            user.id,

          status:
            AssignmentMemberStatus.ASSIGNED,

          endedAt:
            null,

          assignment: {
            status:
              AssignmentStatus.ACTIVE,

            endedAt:
              null,

            ticket: {
              status: {
                in: [
                  TicketStatus.ASSIGNED,
                  TicketStatus.ON_SITE,
                  TicketStatus.IN_PROGRESS,
                ],
              },
            },
          },
        },

        data: {
          status:
            AssignmentMemberStatus.ACCEPTED,

          acceptedAt:
            now,
        },
      });

    if (
      updated.count !==
      1
    ) {
      throw new ConflictException({
        code:
          'ASSIGNMENT_STATE_CHANGED',

        message:
          'Assignment atau status ticket telah berubah. Muat ulang data dan coba kembali.',
      });
    }

    const result =
      await this.prisma.assignmentMember.findUniqueOrThrow({
        where: {
          id:
            member.id,
        },
      });

    await this.audit.write({
      actorUserId:
        user.id,

      action:
        'ASSIGNMENT_ACCEPTED',

      resourceType:
        'assignment_member',

      resourceId:
        member.id,

      after: {
        acceptedAt:
          now.toISOString(),

        status:
          AssignmentMemberStatus.ACCEPTED,
      },
    });

    return result;
  }

  async detail(
    id: string,
    user: AuthUser,
  ) {
    const assignment =
      await this.prisma.ticketAssignment.findUnique({
        where: {
          id,
        },

        include: {
          ticket:
            true,

          assignedBy: {
            select: {
              id: true,
              displayName:
                true,
            },
          },

          members: {
            include: {
              technician: {
                select: {
                  id: true,
                  displayName:
                    true,
                  email:
                    true,
                },
              },

              slaInstances:
                true,
            },
          },
        },
      });

    if (
      !assignment
    ) {
      throw new NotFoundException({
        code:
          'ASSIGNMENT_NOT_FOUND',

        message:
          'Assignment tidak ditemukan.',
      });
    }

    if (
      !user.permissions.includes(
        'ticket.read.all',
      ) &&
      !assignment.members.some(
        (member) =>
          member.technicianId ===
          user.id,
      )
    ) {
      throw new ForbiddenException({
        code:
          'ASSIGNMENT_ACCESS_DENIED',

        message:
          'Assignment tidak dapat diakses.',
      });
    }

    return {
      ...assignment,

      members:
        assignment.members.map(
          (member) => ({
            ...member,

            sla:
              member
                .slaInstances[0]
                ? this.sla.present(
                  member
                    .slaInstances[0],
                )
                : null,
          }),
        ),
    };
  }

  private assertTicketReassignable(
    status: TicketStatus,
  ) {
    if (NON_REASSIGNABLE_TICKET_STATUSES.has(
      status,
    )) {
      throw new ConflictException({
        code: 'TICKET_NOT_REASSIGNABLE',
        message: `Ticket dengan status ${status} tidak dapat di-reassign.`,
        details: {
          status,
        },
      });
    }
  }

  private async ownMember(
    memberId: string,
    userId: string,
  ) {
    const member =
      await this.prisma.assignmentMember.findFirst({
        where: {
          id:
            memberId,

          technicianId:
            userId,

          endedAt:
            null,

          assignment: {
            status:
              AssignmentStatus.ACTIVE,

            endedAt:
              null,
          },
        },

        include: {
          assignment: {
            include: {
              ticket:
                true,
            },
          },
        },
      });

    if (
      !member
    ) {
      throw new ForbiddenException({
        code:
          'ASSIGNMENT_ACCESS_DENIED',

        message:
          'Assignment tidak dapat diakses atau sudah berakhir.',
      });
    }

    return member;
  }
}