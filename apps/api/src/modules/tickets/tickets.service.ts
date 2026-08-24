import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AssignmentMemberStatus,
  AssignmentStatus,
  MediaContext,
  NotificationType,
  Prisma,
  SlaOutcome,
  SlaStatus,
  SlaType,
  TicketResponseType,
  TicketStatus,
} from '@prisma/client';

import { AuthUser } from '../../common/types/auth-user';
import {
  maskPhone,
  normalizePhone,
} from '../../common/utils/phone';
import { evaluateSla } from '../../common/utils/sla';
import { generateTicketCode } from '../../common/utils/ticket-code';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SlaService } from '../sla/sla.service';
import { assertTransition } from './ticket-state-machine';

import {
  ClassificationDto,
  CloseTicketDto,
  CommentDto,
  CreateTicketDto,
  RescheduleTicketDto,
  ResumeTicketDto,
  ResolveTicketDto,
  RespondTicketDto,
  TicketQueryDto,
  TicketSortBy,
  TicketSortOrder,
} from './tickets.dto';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sla: SlaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
  ) { }

  async resolveQr(token: string) {
    const qr = await this.prisma.qrCode.findFirst({
      where: {
        token,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        site: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!qr || !qr.site.isActive) {
      throw new NotFoundException({
        code: 'QR_NOT_FOUND',
        message:
          'QR tidak valid atau sudah tidak aktif.',
      });
    }

    return {
      token: qr.token,
      site: {
        id: qr.site.id,
        code: qr.site.code,
        name: qr.site.name,
        address: qr.site.address,
        client: {
          id: qr.site.client.id,
          name: qr.site.client.name,
        },
      },
    };
  }

  async createPublic(
    dto: CreateTicketDto,
    idempotencyKey?: string,
  ) {
    const DIGITS_ONLY_PATTERN = /^\d+$/;

    if (!DIGITS_ONLY_PATTERN.test(dto.contactPhone)) {
      throw new BadRequestException(
        'Nomor kontak hanya boleh berisi angka 0-9.',
      );
    }
    if (!dto.qrToken && !dto.siteId) {
      throw new NotFoundException({
        code: 'SITE_REQUIRED',
        message:
          'Site atau QR token wajib diisi.',
      });
    }

    if (idempotencyKey) {
      const existingKey =
        await this.prisma.idempotencyKey.findUnique({
          where: {
            key: idempotencyKey,
          },
        });

      if (existingKey?.responseId) {
        return this.publicCreatedResponse(
          existingKey.responseId,
        );
      }
    }

    const site = dto.qrToken
      ? (
        await this.prisma.qrCode.findFirst({
          where: {
            token: dto.qrToken,
            isActive: true,
          },
          include: {
            site: true,
          },
        })
      )?.site
      : await this.prisma.site.findFirst({
        where: {
          id: dto.siteId,
          isActive: true,
        },
      });

    if (!site) {
      throw new NotFoundException({
        code: 'SITE_NOT_FOUND',
        message:
          'Lokasi layanan tidak ditemukan.',
      });
    }

    const priority =
      await this.prisma.ticketPriority.findUniqueOrThrow({
        where: {
          code: 'MEDIUM',
        },
      });

    let ticketCode = generateTicketCode();

    while (
      await this.prisma.ticket.findUnique({
        where: {
          ticketCode,
        },
      })
    ) {
      ticketCode = generateTicketCode();
    }

    const phone = normalizePhone(dto.contactPhone);

    const result =
      await this.prisma.$transaction(
        async (tx) => {
          /*
           * Phase 4:
           * Validasi media dijalankan sebelum ticket dibuat.
           *
           * Jika media invalid, seluruh transaction gagal
           * dan tidak ada ticket/SLA/log yang terbentuk.
           */
          const mediaAssets =
            await this.media.validateForContext(
              dto.mediaIds,
              MediaContext.COMPLAINT,
              undefined,
              tx,
            );

          const ticket =
            await tx.ticket.create({
              data: {
                ticketCode,
                siteId: site.id,
                reporterName:
                  dto.reporterName.trim(),
                picName: dto.picName.trim(),
                contactPhoneNormalized:
                  phone,
                locationDetail:
                  dto.locationDetail,
                categoryId:
                  dto.categoryId,
                priorityId:
                  priority.id,
                description:
                  dto.description.trim(),
                status:
                  TicketStatus.NEW,
              },
            });

          await tx.ticketStatusLog.create({
            data: {
              ticketId: ticket.id,
              fromStatus: null,
              toStatus:
                TicketStatus.NEW,
              metadata: {
                source: 'PUBLIC_FORM',
              },
            },
          });

          await this.sla.createRespond(
            ticket,
            tx,
          );

          /*
           * Semua media yang sudah tervalidasi
           * dipaksa menggunakan context COMPLAINT.
           */
          await tx.mediaLink.createMany({
            data: mediaAssets.map(
              (asset) => ({
                mediaAssetId:
                  asset.id,
                context:
                  MediaContext.COMPLAINT,
                ticketId:
                  ticket.id,
              }),
            ),
          });

          if (idempotencyKey) {
            await tx.idempotencyKey.create({
              data: {
                key: idempotencyKey,
                scope:
                  'PUBLIC_TICKET_CREATE',
                responseId:
                  ticket.id,
                expiresAt:
                  new Date(
                    Date.now() +
                    24 *
                    3600 *
                    1000,
                  ),
              },
            });
          }

          await this.notifications.notifyRoles(
            [
              'ADMINISTRATOR',
              'HEAD',
            ],
            {
              type:
                NotificationType.TICKET_NEW,
              title:
                'Ticket baru',
              body:
                `${ticket.ticketCode} baru dibuat.`,
              relatedType:
                'ticket',
              relatedId:
                ticket.id,
              eventKey:
                `ticket-new-${ticket.id}`,
            },
            tx,
          );

          return ticket;
        },
      );

    await this.audit.write({
      action:
        'TICKET_CREATED_PUBLIC',
      resourceType: 'ticket',
      resourceId: result.id,
      after: {
        ticketCode:
          result.ticketCode,
        siteId:
          result.siteId,
        mediaCount:
          dto.mediaIds.length,
      },
    });

    return {
      id: result.id,
      ticketCode:
        result.ticketCode,
      status:
        result.status,
      createdAt:
        result.createdAt,
    };
  }

  async track(dto: {
    ticketCode: string;
    contactPhone: string;
  }) {
    const ticket =
      await this.prisma.ticket.findFirst({
        where: {
          ticketCode:
            dto.ticketCode
              .trim()
              .toUpperCase(),
          contactPhoneNormalized:
            normalizePhone(
              dto.contactPhone,
            ),
        },
        include: {
          site: {
            include: {
              client: true,
            },
          },
          category: true,
          priority: true,
          responses: {
            where: {
              type: {
                in: [
                  TicketResponseType.OFFICIAL_INITIAL_RESPONSE,
                  TicketResponseType.PUBLIC_UPDATE,
                ],
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
            select: {
              type: true,
              message: true,
              createdAt: true,
            },
          },
          statusLogs: {
            orderBy: {
              createdAt: 'asc',
            },
            select: {
              toStatus: true,
              createdAt: true,
            },
          },
        },
      });

    if (!ticket) {
      throw new NotFoundException({
        code:
          'TRACKING_NOT_FOUND',
        message:
          'Data ticket tidak ditemukan atau informasi tidak cocok.',
      });
    }

    return {
      ticketCode:
        ticket.ticketCode,
      reporterName:
        this.maskName(
          ticket.reporterName,
        ),
      picName:
        this.maskName(
          ticket.picName,
        ),
      contactPhone:
        maskPhone(
          ticket.contactPhoneNormalized,
        ),
      client:
        ticket.site.client.name,
      site:
        ticket.site.name,
      category:
        ticket.category?.name,
      priority:
        ticket.priority.label,
      description:
        ticket.description,
      status:
        ticket.status,
      publicStatus:
        this.publicStatus(
          ticket.status,
        ),
      createdAt:
        ticket.createdAt,
      firstRespondedAt:
        ticket.firstRespondedAt,
      scheduledAt:
        ticket.scheduledAt,
      resolvedAt:
        ticket.resolvedAt,
      closedAt:
        ticket.closedAt,
      responses:
        ticket.responses,
      timeline:
        ticket.statusLogs.map(
          (log) => ({
            status:
              this.publicStatus(
                log.toStatus,
              ),
            createdAt:
              log.createdAt,
          }),
        ),
    };
  }

  async list(
    query: TicketQueryDto,
    user: AuthUser,
  ) {
    const search = query.search?.trim();

    const containsSearch = search
      ? { contains: search, mode: 'insensitive' as const }
      : null;

    const where: Prisma.TicketWhereInput = {
      ...(query.status
        ? {
          status:
            query.status as TicketStatus,
        }
        : {}),
      ...(query.priorityId
        ? {
          priorityId:
            query.priorityId,
        }
        : {}),
      ...(query.siteId
        ? {
          siteId:
            query.siteId,
        }
        : {}),
      ...(query.categoryId
        ? {
          categoryId:
            query.categoryId,
        }
        : {}),
      ...(containsSearch
        ? {
          OR: [
            /* Ticket fields */
            { ticketCode: containsSearch },
            { reporterName: containsSearch },
            { picName: containsSearch },
            { description: containsSearch },

            /* Client fields: Ticket → Site → Client */
            { site: { is: { client: { is: { name: containsSearch } } } } },
            { site: { is: { client: { is: { code: containsSearch } } } } },

            /* Site fields */
            { site: { is: { name: containsSearch } } },
            { site: { is: { code: containsSearch } } },
            { site: { is: { address: containsSearch } } },
          ],
        }
        : {}),
    };

    if (
      !user.permissions.includes(
        'ticket.read.all',
      )
    ) {
      where.assignments = {
        some: {
          members: {
            some: {
              technicianId:
                user.id,
            },
          },
        },
      };
    }

    const orderBy = this.ticketOrderBy(
      query.sortBy,
      query.sortOrder,
    );

    const [tickets, total] =
      await Promise.all([
        this.prisma.ticket.findMany({
          where,
          skip:
            (query.page - 1) *
            query.pageSize,
          take: query.pageSize,
          orderBy,
          include: {
            site: {
              include: {
                client: true,
              },
            },
            category: true,
            priority: true,
            slaInstances: {
              where: {
                slaType:
                  SlaType.RESPOND,
              },
              take: 1,
            },
            assignments: {
              where: {
                status:
                  'ACTIVE',
              },
              include: {
                members: {
                  include: {
                    technician: {
                      select: {
                        id: true,
                        displayName:
                          true,
                      },
                    },
                    slaInstances: {
                      where: {
                        slaType: SlaType.WORK
                      },
                      take: 1
                    }
                  },
                },
              },
            },
          },
        }),

        this.prisma.ticket.count({
          where,
        }),
      ]);

    return {
      data: tickets.map(
        (ticket) => ({
          ...ticket,
          slaRespond:
            ticket
              .slaInstances[0]
              ? this.sla.present(
                ticket
                  .slaInstances[0],
              )
              : null,

          workSlaAggregate:
            this.workAggregate(
              ticket.assignments.flatMap(
                (assignment) =>
                  assignment.members,
              ),
            ),
        }),
      ),

      meta: {
        page: query.page,
        pageSize:
          query.pageSize,
        total,
      },
    };
  }

  private ticketOrderBy(
    sortBy: TicketSortBy,
    sortOrder: TicketSortOrder,
  ): Prisma.TicketOrderByWithRelationInput[] {
    const direction =
      sortOrder === TicketSortOrder.ASC
        ? ('asc' as const)
        : ('desc' as const);

    const primarySort: Record<
      TicketSortBy,
      Prisma.TicketOrderByWithRelationInput
    > = {
      [TicketSortBy.TICKET_CODE]: { ticketCode: direction },
      [TicketSortBy.CLIENT_NAME]: { site: { client: { name: direction } } },
      [TicketSortBy.SITE_NAME]: { site: { name: direction } },
      [TicketSortBy.PRIORITY]: { priority: { severityOrder: direction } },
      [TicketSortBy.STATUS]: { status: direction },
      [TicketSortBy.CREATED_AT]: { createdAt: direction },
    };

    /*
     * createdAt: cukup gunakan id sebagai
     * deterministic tie-breaker.
     */
    if (sortBy === TicketSortBy.CREATED_AT) {
      return [primarySort[sortBy], { id: 'asc' }];
    }

    /*
     * Business column:
     *   primary field
     *   → newest ticket (createdAt DESC)
     *   → UUID sebagai final tie-breaker (id ASC)
     *
     * Menjaga pagination stabil ketika banyak ticket
     * memiliki nilai primary sort yang sama.
     */
    return [
      primarySort[sortBy],
      { createdAt: 'desc' },
      { id: 'asc' },
    ];
  }

  async detail(
    id: string,
    user: AuthUser,
  ) {
    await this.assertReadAccess(
      id,
      user,
    );

    const ticket =
      await this.prisma.ticket.findUnique({
        where: {
          id,
        },
        include: {
          site: {
            include: {
              client: true,
            },
          },
          category: true,
          priority: true,

          responses: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  displayName:
                    true,
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
          },

          comments: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  displayName:
                    true,
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
          },

          statusLogs: {
            include: {
              actor: {
                select: {
                  id: true,
                  displayName:
                    true,
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
          },

          mediaLinks: {
            include: {
              mediaAsset: true,
            },
          },

          slaInstances: {
            where: {
              slaType:
                SlaType.RESPOND,
            },
          },

          assignments: {
            orderBy: {
              assignedAt: 'asc',
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
                      email: true,
                    },
                  },
                  slaInstances: {
                    where: {
                      slaType: SlaType.WORK
                    },
                    take: 1
                  },
                  checkins: {
                    include: {
                      mediaLinks: {
                        include: {
                          mediaAsset:
                            true,
                        },
                      },
                    },
                    orderBy: {
                      serverReceivedAt:
                        'asc',
                    },
                  },
                  workCompletions: {
                    include: {
                      mediaLinks: {
                        include: {
                          mediaAsset:
                            true,
                        },
                      },
                    },
                    orderBy: {
                      completedAt:
                        'asc',
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!ticket) {
      throw new NotFoundException({
        code:
          'TICKET_NOT_FOUND',
        message:
          'Ticket tidak ditemukan.',
      });
    }

    return {
      ...ticket,

      slaRespond:
        ticket.slaInstances[0]
          ? this.sla.present(
            ticket
              .slaInstances[0],
          )
          : null,

      assignments:
        ticket.assignments.map(
          (assignment) => ({
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
          }),
        ),

      workSlaAggregate:
        this.workAggregate(
          ticket.assignments
            .filter(
              (assignment) =>
                assignment.status ===
                'ACTIVE',
            )
            .flatMap(
              (assignment) =>
                assignment.members,
            ),
        ),
    };
  }

  async respond(
    id: string,
    dto: RespondTicketDto,
    actor: AuthUser,
  ) {
    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const ticket =
            await tx.ticket.findUniqueOrThrow({
              where: {
                id,
              },
              include: {
                slaInstances: {
                  where: {
                    slaType:
                      SlaType.RESPOND,
                  },
                  take: 1,
                },
              },
            });

          assertTransition(
            ticket.status,
            TicketStatus.RESPONDED,
          );

          const now = new Date();

          const updated =
            await tx.ticket.updateMany({
              where: {
                id,
                status:
                  TicketStatus.NEW,
                firstRespondedAt:
                  null,
                version:
                  ticket.version,
              },
              data: {
                firstRespondedAt:
                  now,
                status:
                  TicketStatus.RESPONDED,
                priorityId:
                  dto.priorityId,
                categoryId:
                  dto.categoryId,
                version: {
                  increment: 1,
                },
              },
            });

          if (updated.count !== 1) {
            throw new ConflictException({
              code:
                'FIRST_RESPONSE_CONFLICT',
              message:
                'Ticket sudah direspons oleh actor lain.',
            });
          }

          const response =
            await tx.ticketResponse.create({
              data: {
                ticketId: id,
                type:
                  TicketResponseType.OFFICIAL_INITIAL_RESPONSE,
                message:
                  dto.message,
                createdById:
                  actor.id,
              },
            });

          await tx.ticketStatusLog.create({
            data: {
              ticketId: id,
              fromStatus:
                ticket.status,
              toStatus:
                TicketStatus.RESPONDED,
              actorId:
                actor.id,
              metadata:
                dto.nextAction
                  ? {
                    nextAction:
                      dto.nextAction,
                  }
                  : undefined,
            },
          });

          const instance =
            ticket.slaInstances[0];

          if (instance) {
            await this.sla.complete(
              instance.id,
              now,
              tx,
            );
          }

          return response;
        },
      );

    await this.audit.write({
      actorUserId: actor.id,
      action:
        'TICKET_RESPONDED',
      resourceType: 'ticket',
      resourceId: id,
      after: {
        responseId:
          result.id,
      },
    });

    return result;
  }

  async classify(
    id: string,
    dto: ClassificationDto,
    actor: AuthUser,
  ) {
    const before =
      await this.prisma.ticket.findUniqueOrThrow({
        where: {
          id,
        },
        select: {
          priorityId: true,
          categoryId: true,
        },
      });

    const updated =
      await this.prisma.ticket.update({
        where: {
          id,
        },
        data: {
          priorityId:
            dto.priorityId,
          categoryId:
            dto.categoryId,
          version: {
            increment: 1,
          },
        },
        include: {
          priority: true,
          category: true,
        },
      });

    await this.audit.write({
      actorUserId: actor.id,
      action:
        'TICKET_CLASSIFIED',
      resourceType: 'ticket',
      resourceId: id,
      before,
      after: {
        priorityId:
          updated.priorityId,
        categoryId:
          updated.categoryId,
        reason: dto.reason,
      },
    });

    return updated;
  }

  async cancel(
    id: string,
    reason: string,
    actor: AuthUser,
  ) {
    return this.terminate(
      id,
      TicketStatus.CANCELLED,
      reason,
      actor,
    );
  }

  private async terminate(
    id: string,
    toStatus: 'CANCELLED',
    reason: string,
    actor: AuthUser,
  ) {
    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const ticket =
            await tx.ticket.findUniqueOrThrow({
              where: {
                id,
              },
              include: {
                slaInstances: {
                  where: {
                    status: {
                      in: [
                        SlaStatus.OPEN,
                        SlaStatus.WARNING,
                        SlaStatus.BREACHED,
                      ],
                    },
                    completedAt: null,
                    endedAt: null,
                  },
                },
              },
            });

          assertTransition(
            ticket.status,
            toStatus,
          );

          const now = new Date();

          const activeAssignments =
            await tx.ticketAssignment.findMany({
              where: {
                ticketId:
                  id,
                status:
                  AssignmentStatus.ACTIVE,
              },

              select: {
                id: true,
                members: {
                  where: {
                    endedAt: null,
                  },

                  select: {
                    id: true,
                    slaInstances: {
                      where: {
                        slaType: SlaType.WORK,
                        status: {
                          in: [
                            SlaStatus.OPEN,
                            SlaStatus.WARNING,
                            SlaStatus.BREACHED,
                          ],
                        },

                        completedAt: null,
                        endedAt: null,
                      },

                      select: {
                        id: true,
                      },
                    },
                  },
                },
              },
            });

          const activeAssignmentsIds =
            activeAssignments.map(
              (assignment) => assignment.id,
            );

          const activeMembers =
            activeAssignments.flatMap(
              (assignment) => assignment.members,
            );

          const activeMemberIds =
            activeMembers.map(
              (member) => member.id,
            );

          const activeWorkSlaIds =
            activeMembers.flatMap(
              (member) => member.slaInstances.map(
                (instance) => instance.id,
              ),
            );

          if (
            activeAssignmentsIds.length > 0
          ) {
            await tx.ticketAssignment.updateMany({
              where: {
                id: {
                  in: activeAssignmentsIds,
                },
                status: AssignmentStatus.ACTIVE
              },
              data: {
                status: AssignmentStatus.ENDED,
                endedAt: now,
              },
            });
          }

          if (activeMemberIds.length > 0) {
            await tx.assignmentMember.updateMany({
              where: {
                id: {
                  in: activeMemberIds,
                },
                endedAt: null,
              },
              data: { endedAt: now, },
            });
          }

          for (
            const instanceId of activeWorkSlaIds
          ) {
            await this.sla.end(
              instanceId,
              now,
              SlaOutcome.CANCELLED,
              tx,
            );
          }

          for (
            const instance of ticket.slaInstances
          ) {
            await this.sla.end(
              instance.id,
              now,
              SlaOutcome.CANCELLED,
              tx,
            )
          }

          const result =
            await tx.ticket.update({
              where: {
                id,
              },
              data: {
                status: toStatus,

                pendingReason: null,
                scheduledAt: null,
                version: {
                  increment: 1,
                },
              },
            });

          await tx.ticketStatusLog.create({
            data: {
              ticketId: id,
              fromStatus:
                ticket.status,
              toStatus,
              actorId:
                actor.id,
              reason,
              metadata: {
                endedAssignmentCount: activeAssignmentsIds.length,
                endedMemberCount: activeMemberIds.length,
                endedWorkSlaCount: activeWorkSlaIds.length,
              },
            },
          });

          return result;
        },
      );

    await this.audit.write({
      actorUserId: actor.id,
      action:
        `TICKET_${toStatus}`,
      resourceType: 'ticket',
      resourceId: id,
      after: {
        reason,
      },
    });

    return updated;
  }

  async resolve(
    id: string,
    dto: ResolveTicketDto,
    actor: AuthUser,
  ) {
    /*
     * Defense-in-depth.
     *
     * Controller sudah membutuhkan ticket.resolve,
     * tetapi roadmap Phase 6 secara eksplisit
     * menyatakan Technician tidak menjalankan resolve.
     *
     * Jangan hanya bergantung pada permission DB.
     */
    this.assertResolveRole(
      actor,
    );

    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const ticket =
            await tx.ticket.findUniqueOrThrow({
              where: {
                id,
              },

              include: {
                assignments: {
                  where: {
                    status:
                      AssignmentStatus.ACTIVE,
                  },

                  include: {
                    members:
                      true,
                  },
                },
              },
            });

          /*
           * Gunakan state machine sebagai source of truth.
           *
           * State machine project saat ini hanya mengizinkan:
           *
           * IN_PROGRESS -> RESOLVED
           *
           * Dengan demikian:
           * ASSIGNED  -> RESOLVED ditolak
           * ON_SITE   -> RESOLVED ditolak
           * REOPENED  -> RESOLVED ditolak
           *
           * Ini sekaligus menutup bypass check-in/start.
           */
          assertTransition(
            ticket.status,
            TicketStatus.RESOLVED,
          );

          const activeMembers =
            ticket.assignments.flatMap(
              (assignment) =>
                assignment.members.filter(
                  (member) =>
                    !member.endedAt,
                ),
            );

          /*
           * requiredForResolution merupakan business rule
           * yang sudah ada pada schema.
           *
           * Optional member tidak perlu menghalangi resolve.
           */
          const requiredMembers =
            activeMembers.filter(
              (member) =>
                member.requiredForResolution,
            );

          /*
           * Ticket operational tidak boleh di-resolve
           * tanpa satu pun required technician.
           *
           * Tanpa guard ini, Head dapat mengubah seluruh member
           * menjadi requiredForResolution=false lalu resolve.
           */
          if (
            requiredMembers.length ===
            0
          ) {
            throw new ConflictException({
              code:
                'RESOLUTION_REQUIRED_MEMBER_MISSING',

              message:
                'Ticket harus memiliki minimal satu teknisi aktif yang wajib menyelesaikan pekerjaan sebelum dapat di-resolve.',
            });
          }

          /*
           * Jangan hanya memeriksa status COMPLETED.
           *
           * Pastikan lifecycle technician benar-benar:
           *
           * check-in
           * -> start work
           * -> complete
           */
          const incompleteMembers =
            requiredMembers.filter(
              (member) =>
                member.status !==
                AssignmentMemberStatus.COMPLETED ||
                !member.firstCheckinAt ||
                !member.workStartedAt ||
                !member.completedAt,
            );

          if (
            incompleteMembers.length >
            0
          ) {
            throw new ConflictException({
              code:
                'ASSIGNMENT_INCOMPLETE',

              message:
                'Seluruh teknisi wajib harus menyelesaikan workflow check-in, start work, dan completion sebelum ticket dapat di-resolve.',

              details: {
                members:
                  incompleteMembers.map(
                    (member) => ({
                      memberId:
                        member.id,

                      status:
                        member.status,

                      hasCheckin:
                        !!member.firstCheckinAt,

                      hasStartedWork:
                        !!member.workStartedAt,

                      hasCompleted:
                        !!member.completedAt,
                    }),
                  ),
              },
            });
          }

          /*
           * Status/timestamp belum cukup.
           *
           * Buktikan bahwa setiap required member mempunyai:
           *
           * WorkCompletion
           * +
           * MediaLink context COMPLETION
           * +
           * MediaAsset foto/video valid.
           */
          await this.media.assertCompletionEvidenceForMembers(
            requiredMembers.map(
              (member) =>
                member.id,
            ),

            tx,
          );

          const now =
            new Date();

          const updated =
            await tx.ticket.update({
              where: {
                id,
              },

              data: {
                status:
                  TicketStatus.RESOLVED,

                resolvedAt:
                  now,

                version: {
                  increment:
                    1,
                },
              },
            });

          await tx.ticketComment.create({
            data: {
              ticketId:
                id,

              message:
                dto.summary,

              isPublic:
                true,

              createdById:
                actor.id,
            },
          });

          await tx.ticketStatusLog.create({
            data: {
              ticketId:
                id,

              fromStatus:
                ticket.status,

              toStatus:
                TicketStatus.RESOLVED,

              actorId:
                actor.id,

              metadata: {
                resolutionSummary:
                  dto.summary,

                completionVerified:
                  true,

                requiredMemberIds:
                  requiredMembers.map(
                    (member) =>
                      member.id,
                  ),
              },
            },
          });

          await this.notifications.notifyRoles(
            [
              'ADMINISTRATOR',
              'HEAD',
            ],

            {
              type:
                NotificationType.TICKET_RESOLVED,

              title:
                'Ticket resolved',

              body:
                `${ticket.ticketCode} menunggu verifikasi.`,

              relatedType:
                'ticket',

              relatedId:
                id,

              eventKey:
                `ticket-resolved-${id}-${ticket.serviceCycleNo}`,
            },

            tx,
          );

          return updated;
        },
      );

    await this.audit.write({
      actorUserId:
        actor.id,

      action:
        'TICKET_RESOLVED',

      resourceType:
        'ticket',

      resourceId:
        id,

      after: {
        summary:
          dto.summary,

        completionVerified:
          true,
      },
    });

    return result;
  }

  async close(
    id: string,
    dto: CloseTicketDto,
    actor: AuthUser,
  ) {
    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const ticket =
            await tx.ticket.findUniqueOrThrow({
              where: {
                id,
              },
            });

          assertTransition(
            ticket.status,
            TicketStatus.CLOSED,
          );

          const now = new Date();

          const updated =
            await tx.ticket.update({
              where: {
                id,
              },
              data: {
                status:
                  TicketStatus.CLOSED,
                closedAt:
                  now,
                version: {
                  increment: 1,
                },
              },
            });

          await tx.ticketStatusLog.create({
            data: {
              ticketId: id,
              fromStatus:
                ticket.status,
              toStatus:
                TicketStatus.CLOSED,
              actorId:
                actor.id,
              reason:
                dto.verificationNote,
            },
          });

          await this.notifications.notifyRoles(
            [
              'ADMINISTRATOR',
              'HEAD',
            ],
            {
              type:
                NotificationType.TICKET_CLOSED,
              title:
                'Ticket ditutup',
              body:
                `${ticket.ticketCode} selesai diverifikasi.`,
              relatedType:
                'ticket',
              relatedId: id,
              eventKey:
                `ticket-closed-${id}-${ticket.serviceCycleNo}`,
            },
            tx,
          );

          return updated;
        },
      );

    await this.audit.write({
      actorUserId:
        actor.id,
      action:
        'TICKET_CLOSED',
      resourceType:
        'ticket',
      resourceId: id,
      after: dto,
    });

    return result;
  }

  async reschedule(
    id: string,
    dto: RescheduleTicketDto,
    actor: AuthUser,
  ) {
    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const ticket =
            await tx.ticket.findUniqueOrThrow({
              where: {
                id,
              },
            });

          assertTransition(
            ticket.status,
            TicketStatus.PENDING,
          );

          const updated =
            await tx.ticket.update({
              where: {
                id,
              },
              data: {
                status:
                  TicketStatus.PENDING,
                pendingReason:
                  dto.reason,
                scheduledAt:
                  new Date(
                    dto.scheduledAt,
                  ),
                version: {
                  increment: 1,
                },
              },
            });

          await tx.ticketStatusLog.create({
            data: {
              ticketId: id,
              fromStatus:
                ticket.status,
              toStatus:
                TicketStatus.PENDING,
              actorId:
                actor.id,
              reason:
                dto.reason,
              metadata: {
                previousStatus:
                  ticket.status,
                scheduledAt:
                  dto.scheduledAt,
              },
            },
          });

          return updated;
        },
      );

    await this.audit.write({
      actorUserId:
        actor.id,
      action:
        'TICKET_RESCHEDULED',
      resourceType:
        'ticket',
      resourceId: id,
      after: {
        reason:
          dto.reason,
        scheduledAt:
          dto.scheduledAt,
      },
    });

    return result;
  }

  async resume(
    id: string,
    dto: ResumeTicketDto,
    actor: AuthUser,
  ) {
    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const ticket =
            await tx.ticket.findUniqueOrThrow({
              where: {
                id,
              },
            });

          if (
            ticket.status !==
            TicketStatus.PENDING
          ) {
            throw new ConflictException({
              code:
                'TICKET_NOT_PENDING',
              message:
                'Ticket tidak dalam status pending/reschedule.',
            });
          }

          const lastPendingLog =
            await tx.ticketStatusLog.findFirst({
              where: {
                ticketId: id,
                toStatus:
                  TicketStatus.PENDING,
              },
              orderBy: {
                createdAt: 'desc',
              },
            });

          const previousStatus =
            (
              lastPendingLog?.metadata as
              | Record<
                string,
                string
              >
              | null
            )?.previousStatus as
            | TicketStatus
            | undefined;

          const toStatus: TicketStatus =
            !previousStatus ||
              (
                [
                  TicketStatus.NEW,
                  TicketStatus.RESPONDED,
                ] as TicketStatus[]
              ).includes(
                previousStatus,
              )
              ? TicketStatus.RESPONDED
              : TicketStatus.ASSIGNED;

          assertTransition(
            ticket.status,
            toStatus,
          );

          const updated =
            await tx.ticket.update({
              where: {
                id,
              },
              data: {
                status: toStatus,
                pendingReason:
                  null,
                scheduledAt:
                  null,
                version: {
                  increment: 1,
                },
              },
            });

          await tx.ticketStatusLog.create({
            data: {
              ticketId: id,
              fromStatus:
                TicketStatus.PENDING,
              toStatus,
              actorId:
                actor.id,
              reason:
                dto.note,
              metadata: {
                resumedFrom:
                  'PENDING',
                previousStatus:
                  previousStatus ??
                  null,
              },
            },
          });

          return updated;
        },
      );

    await this.audit.write({
      actorUserId:
        actor.id,
      action:
        'TICKET_RESUMED',
      resourceType:
        'ticket',
      resourceId: id,
      after: {
        note: dto.note,
      },
    });

    return result;
  }

  async reopen(
    id: string,
    reason: string,
    actor: AuthUser,
  ) {
    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const ticket =
            await tx.ticket.findUniqueOrThrow({
              where: {
                id,
              },
            });

          assertTransition(
            ticket.status,
            TicketStatus.REOPENED,
          );

          const updated =
            await tx.ticket.update({
              where: {
                id,
              },
              data: {
                status:
                  TicketStatus.REOPENED,
                serviceCycleNo: {
                  increment: 1,
                },
                resolvedAt:
                  null,
                closedAt:
                  null,
                version: {
                  increment: 1,
                },
              },
            });

          await tx.ticketAssignment.updateMany({
            where: {
              ticketId: id,
              status:
                'ACTIVE',
            },
            data: {
              status: 'ENDED',
              endedAt:
                new Date(),
            },
          });

          await tx.ticketStatusLog.create({
            data: {
              ticketId: id,
              fromStatus:
                ticket.status,
              toStatus:
                TicketStatus.REOPENED,
              actorId:
                actor.id,
              reason,
              metadata: {
                serviceCycleNo:
                  updated.serviceCycleNo,
              },
            },
          });

          await this.notifications.notifyRoles(
            [
              'ADMINISTRATOR',
              'HEAD',
            ],
            {
              type:
                NotificationType.TICKET_REOPENED,
              title:
                'Ticket dibuka kembali',
              body:
                `${ticket.ticketCode} dibuka kembali.`,
              relatedType:
                'ticket',
              relatedId: id,
              eventKey:
                `ticket-reopened-${id}-${updated.serviceCycleNo}`,
            },
            tx,
          );

          return updated;
        },
      );

    await this.audit.write({
      actorUserId:
        actor.id,
      action:
        'TICKET_REOPENED',
      resourceType:
        'ticket',
      resourceId: id,
      after: {
        reason,
      },
    });

    return result;
  }

  async comment(
    id: string,
    dto: CommentDto,
    actor: AuthUser,
  ) {
    await this.assertReadAccess(
      id,
      actor,
    );

    return this.prisma.ticketComment.create({
      data: {
        ticketId: id,
        message: dto.message,
        isPublic:
          !!dto.isPublic,
        createdById:
          actor.id,
      },
      include: {
        createdBy: {
          select: {
            displayName:
              true,
          },
        },
      },
    });
  }

  async timeline(
    id: string,
    user: AuthUser,
  ) {
    await this.assertReadAccess(
      id,
      user,
    );

    return this.prisma.ticketStatusLog.findMany({
      where: {
        ticketId: id,
      },
      include: {
        actor: {
          select: {
            displayName:
              true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  private assertResolveRole(
    actor: AuthUser,
  ): void {
    const canResolve =
      actor.roles.includes(
        'ADMINISTRATOR',
      ) ||
      actor.roles.includes(
        'HEAD',
      );

    if (!canResolve) {
      throw new ForbiddenException({
        code:
          'TICKET_RESOLVE_FORBIDDEN',

        message:
          'Hanya Head atau Administrator yang dapat melakukan resolve ticket.',
      });
    }
  }

  private async assertReadAccess(
    ticketId: string,
    user: AuthUser,
  ) {
    if (
      user.permissions.includes(
        'ticket.read.all',
      )
    ) {
      return;
    }

    const allowed =
      await this.prisma.assignmentMember.count({
        where: {
          technicianId:
            user.id,
          assignment: {
            ticketId,
          },
        },
      });

    if (!allowed) {
      throw new ForbiddenException({
        code:
          'TICKET_ACCESS_DENIED',
        message:
          'Anda tidak memiliki akses ke ticket ini.',
      });
    }
  }

  private async publicCreatedResponse(
    ticketId: string,
  ) {
    const ticket =
      await this.prisma.ticket.findUniqueOrThrow({
        where: {
          id: ticketId,
        },
      });

    return {
      id: ticket.id,
      ticketCode:
        ticket.ticketCode,
      status:
        ticket.status,
      createdAt:
        ticket.createdAt,
    };
  }

  private publicStatus(
    status: TicketStatus,
  ): string {
    const map: Record<
      TicketStatus,
      string
    > = {
      NEW:
        'Dalam Antrian',
      RESPONDED:
        'Sudah Direspons',
      ASSIGNED:
        'Teknisi Ditugaskan',
      ON_SITE:
        'Sedang Dikerjakan',
      IN_PROGRESS:
        'Sedang Dikerjakan',
      RESOLVED:
        'Menunggu Verifikasi',
      CLOSED:
        'Selesai',

      /*
       * Backward compatibility.
       * REJECTED tetap bisa dibaca
       * untuk histori lama.
       */
      REJECTED:
        'Ditolak',

      REOPENED:
        'Sedang Dikerjakan',
      CANCELLED:
        'Dibatalkan',
      PENDING:
        'Dijadwalkan Ulang',
    };

    return map[status];
  }

  private maskName(
    value: string,
  ): string {
    return value
      .split(/\s+/)
      .map((part) =>
        part.length <= 2
          ? `${part[0]}*`
          : `${part.slice(
            0,
            2,
          )}${'*'.repeat(
            Math.min(
              5,
              part.length - 2,
            ),
          )}`,
      )
      .join(' ');
  }

  private workAggregate(
    members: Array<{
      requiredForResolution: boolean;
      endedAt: Date | null;
      slaInstances: Array<{
        startedAt: Date;
        warningAt: Date;
        dueAt: Date;
        completedAt:
        | Date
        | null;
        endedAt:
        | Date
        | null;
        outcome:
        | SlaOutcome
        | null;
      }>;
    }>,
  ) {
    const runtimes = members
      .filter(
        (member) =>
          member.requiredForResolution &&
          !member.endedAt,
      )
      .map(
        (member) =>
          member.slaInstances[0],
      )
      .filter(Boolean)
      .map((item) =>
        evaluateSla(item),
      );

    if (!runtimes.length) {
      return {
        status:
          'NOT_STARTED',
        met: 0,
        breached: 0,
        active: 0,
      };
    }

    const status =
      runtimes.some(
        (runtime) =>
          runtime.status ===
          SlaStatus.BREACHED ||
          runtime.outcome ===
          SlaOutcome.COMPLETED_BREACHED,
      )
        ? 'BREACHED'
        : runtimes.some(
          (runtime) =>
            runtime.status ===
            SlaStatus.WARNING,
        )
          ? 'WARNING'
          : runtimes.every(
            (runtime) =>
              runtime.outcome ===
              SlaOutcome.MET,
          )
            ? 'MET'
            : 'ON_TRACK';

    return {
      status,

      met: runtimes.filter(
        (runtime) =>
          runtime.outcome ===
          SlaOutcome.MET,
      ).length,

      breached:
        runtimes.filter(
          (runtime) =>
            runtime.status ===
            SlaStatus.BREACHED ||
            runtime.outcome ===
            SlaOutcome.COMPLETED_BREACHED,
        ).length,

      active:
        runtimes.filter(
          (runtime) =>
            !runtime.outcome,
        ).length,
    };
  }
}