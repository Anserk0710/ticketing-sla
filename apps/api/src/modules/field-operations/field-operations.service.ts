import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import {
  AssignmentMemberStatus,
  AssignmentStatus,
  MediaContext,
  NotificationType,
  SlaType,
  TicketStatus,
} from '@prisma/client';

import { assertTechnicianOperational } from '../tickets/ticket-state-machine';

import {
  AuthUser,
} from '../../common/types/auth-user';

import {
  haversineMeters,
} from '../../common/utils/distance';

import {
  PrismaService,
} from '../../database/prisma.service';

import {
  AuditService,
} from '../audit/audit.service';

import {
  MediaService,
} from '../media/media.service';

import {
  NotificationsService,
} from '../notifications/notifications.service';

import {
  SlaService,
} from '../sla/sla.service';

import {
  CheckinDto,
  CompleteWorkDto,
  StartWorkDto,
} from './field-operations.dto';

@Injectable()
export class FieldOperationsService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly sla:
      SlaService,

    private readonly notifications:
      NotificationsService,

    private readonly audit:
      AuditService,

    private readonly media:
      MediaService,
  ) { }

  async checkin(
    memberId: string,
    dto: CheckinDto,
    user: AuthUser,
  ) {
    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const member =
            await tx.assignmentMember.findFirst({
              where: {
                id:
                  memberId,

                technicianId:
                  user.id,

                endedAt:
                  null,

                /*
                 * C-01:
                 * Parent assignment juga wajib masih ACTIVE.
                 */
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
                    ticket: {
                      include: {
                        site:
                          true,
                      },
                    },
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

          /*
           * Shared backend guard.
           *
           * Ticket:
           * ASSIGNED / ON_SITE / IN_PROGRESS = operational.
           *
           * PENDING / CANCELLED / CLOSED / RESOLVED / dll
           * akan ditolak.
           */
          assertTechnicianOperational(
            member.assignment
              .ticket.status,
          );

          /*
           * H-01:
           *
           * Check-in wajib melalui Accept terlebih dahulu.
           *
           * Strict member state machine:
           *
           * ASSIGNED
           *    ↓ Accept
           * ACCEPTED
           *    ↓ Check-in
           * ON_SITE
           */
          if (
            member.status !==
            AssignmentMemberStatus.ACCEPTED
          ) {
            throw new ConflictException({
              code:
                'CHECKIN_REQUIRES_ACCEPTED',

              message:
                member.status ===
                  AssignmentMemberStatus.ASSIGNED
                  ? 'Terima assignment terlebih dahulu sebelum melakukan check-in.'
                  : 'Check-in tidak dapat dilakukan pada status teknisi saat ini.',

              details: {
                memberStatus:
                  member.status,

                requiredStatus:
                  AssignmentMemberStatus.ACCEPTED,
              },
            });
          }

          /*
           * Defense-in-depth:
           *
           * ACCEPTED semestinya selalu mempunyai acceptedAt.
           */
          if (
            !member.acceptedAt
          ) {
            throw new ConflictException({
              code:
                'ASSIGNMENT_ACCEPTANCE_INVALID',

              message:
                'Data penerimaan assignment tidak valid. Assignment harus diterima sebelum check-in.',
            });
          }

          /*
           * Phase 4 + Phase 6:
           *
           * - wajib tepat 1 media;
           * - hanya image;
           * - JPEG / PNG / WEBP;
           * - media harus dimiliki technician;
           * - C-04: file fisik juga diverifikasi MediaService.
           */
          const mediaAssets =
            await this.media.validateForContext(
              dto.mediaIds,

              MediaContext.CHECKIN,

              user.id,

              tx,
            );

          const now =
            new Date();

          const distance =
            haversineMeters(
              dto.latitude,
              dto.longitude,

              member.assignment
                .ticket.site
                .latitude,

              member.assignment
                .ticket.site
                .longitude,
            );

          const checkin =
            await tx.checkin.create({
              data: {
                assignmentMemberId:
                  member.id,

                latitude:
                  dto.latitude,

                longitude:
                  dto.longitude,

                accuracyMeters:
                  dto.accuracyMeters,

                deviceCapturedAt:
                  dto.deviceCapturedAt
                    ? new Date(
                      dto.deviceCapturedAt,
                    )
                    : null,

                addressSnapshot:
                  dto.addressSnapshot,

                distanceFromSiteMeters:
                  distance,

                notes:
                  dto.notes,

                serverReceivedAt:
                  now,
              },
            });

          await tx.mediaLink.createMany({
            data:
              mediaAssets.map(
                (asset) => ({
                  mediaAssetId:
                    asset.id,

                  context:
                    MediaContext.CHECKIN,

                  assignmentMemberId:
                    member.id,

                  checkinId:
                    checkin.id,
                }),
              ),
          });

          /*
           * Member transition:
           *
           * ACCEPTED -> ON_SITE
           *
           * updateMany digunakan sebagai CAS sehingga duplicate
           * concurrent check-in tidak dapat menghasilkan dua
           * arrival event untuk member yang sama.
           */
          const memberTransition =
            await tx.assignmentMember.updateMany({
              where: {
                id:
                  member.id,

                status:
                  AssignmentMemberStatus.ACCEPTED,

                acceptedAt: {
                  not:
                    null,
                },

                firstCheckinAt:
                  null,

                endedAt:
                  null,
              },

              data: {
                status:
                  AssignmentMemberStatus.ON_SITE,

                firstCheckinAt:
                  now,
              },
            });

          if (
            memberTransition.count !==
            1
          ) {
            throw new ConflictException({
              code:
                'CHECKIN_STATE_CHANGED',

              message:
                'Status assignment berubah saat check-in diproses. Muat ulang data dan coba kembali.',
            });
          }

          await this.sla.createWork(
            member,
            member.assignment.ticket,
            now,
            tx,
          );

          /*
           * Ticket-level transition hanya dilakukan oleh
           * technician PERTAMA yang check-in.
           *
           * Penting untuk multi-technician:
           *
           * A dan B bisa check-in hampir bersamaan.
           *
           * Hanya:
           *
           * ASSIGNED -> ON_SITE
           *
           * yang boleh dilakukan di sini.
           *
           * Jika ticket sudah ON_SITE atau IN_PROGRESS karena
           * technician lain, JANGAN menurunkan status ticket.
           */
          const ticketTransition =
            await tx.ticket.updateMany({
              where: {
                id:
                  member.assignment
                    .ticketId,

                status:
                  TicketStatus.ASSIGNED,
              },

              data: {
                status:
                  TicketStatus.ON_SITE,

                version: {
                  increment:
                    1,
                },
              },
            });

          if (
            ticketTransition.count ===
            1
          ) {
            await tx.ticketStatusLog.create({
              data: {
                ticketId:
                  member.assignment
                    .ticketId,

                fromStatus:
                  TicketStatus.ASSIGNED,

                toStatus:
                  TicketStatus.ON_SITE,

                actorId:
                  user.id,

                metadata: {
                  assignmentMemberId:
                    member.id,

                  checkinId:
                    checkin.id,
                },
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
                NotificationType.TECHNICIAN_CHECKIN,

              title:
                'Teknisi check-in',

              body:
                `${user.displayName} check-in pada ${member.assignment.ticket.ticketCode}.`,

              relatedType:
                'ticket',

              relatedId:
                member.assignment
                  .ticketId,

              eventKey:
                `checkin-${checkin.id}`,
            },

            tx,
          );

          return checkin;
        },
      );

    await this.audit.write({
      actorUserId:
        user.id,

      action:
        'FIELD_CHECKIN',

      resourceType:
        'checkin',

      resourceId:
        result.id,

      after: {
        assignmentMemberId:
          memberId,

        latitude:
          dto.latitude,

        longitude:
          dto.longitude,

        accuracyMeters:
          dto.accuracyMeters,

        mediaIds:
          dto.mediaIds,
      },
    });

    return result;
  }

  async start(
    memberId: string,
    dto: StartWorkDto,
    user: AuthUser,
  ) {
    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const member =
            await tx.assignmentMember.findFirst({
              where: {
                id:
                  memberId,

                technicianId:
                  user.id,

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

                slaInstances: {
                  where: {
                    slaType: SlaType.WORK,
                  },

                  take: 1
                }
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

          assertTechnicianOperational(
            member.assignment
              .ticket.status,
          );

          /*
           * Strict lifecycle:
           *
           * Check-in wajib berhasil terlebih dahulu.
           */
          if (
            member.status !==
            AssignmentMemberStatus.ON_SITE
          ) {
            throw new ConflictException({
              code:
                'WORK_START_NOT_ALLOWED',

              message:
                'Lakukan Accept dan Check-in terlebih dahulu sebelum memulai pekerjaan.',

              details: {
                memberStatus:
                  member.status,

                requiredStatus:
                  AssignmentMemberStatus.ON_SITE,
              },
            });
          }

          /*
           * Defense-in-depth:
           * status ON_SITE harus memiliki check-in.
           */
          if (
            !member.firstCheckinAt
          ) {
            throw new ConflictException({
              code:
                'CHECKIN_REQUIRED',

              message:
                'Data check-in tidak ditemukan. Check-in wajib dilakukan sebelum memulai pekerjaan.',
            });
          }

          const workSla = member.slaInstances[0];

          if (!workSla) {
            throw new ConflictException({
              code: 'WORK_SLA_NOT_STARTED',
              message: 'SLA pengerjaan tidak ditemukan setelah check-in. Muat ulang data atau hubungi Administrator.',
              details: {
                assignmentMemberId: member.id,
                firstCheckinAt: member.firstCheckinAt,
              },
            });
          }

          const now =
            new Date();

          /*
           * ON_SITE -> IN_PROGRESS
           *
           * CAS mencegah double start.
           */
          const memberTransition =
            await tx.assignmentMember.updateMany({
              where: {
                id:
                  member.id,

                status:
                  AssignmentMemberStatus.ON_SITE,

                firstCheckinAt: {
                  not:
                    null,
                },

                workStartedAt:
                  null,

                endedAt:
                  null,
              },

              data: {
                status:
                  AssignmentMemberStatus.IN_PROGRESS,

                workStartedAt:
                  now,
              },
            });

          if (
            memberTransition.count !==
            1
          ) {
            throw new ConflictException({
              code:
                'WORK_START_STATE_CHANGED',

              message:
                'Status assignment berubah saat pekerjaan dimulai. Muat ulang data dan coba kembali.',
            });
          }

          /*
           * Technician pertama yang start:
           *
           * Ticket ON_SITE -> IN_PROGRESS.
           *
           * Technician kedua/ketiga yang start ketika ticket
           * sudah IN_PROGRESS tidak melakukan ticket transition.
           *
           * Conditional UPDATE mencegah stale request menurunkan
           * atau menulis ulang status ticket.
           */
          const ticketTransition =
            await tx.ticket.updateMany({
              where: {
                id:
                  member.assignment
                    .ticketId,

                status:
                  TicketStatus.ON_SITE,
              },

              data: {
                status:
                  TicketStatus.IN_PROGRESS,

                version: {
                  increment:
                    1,
                },
              },
            });

          if (
            ticketTransition.count ===
            1
          ) {
            await tx.ticketStatusLog.create({
              data: {
                ticketId:
                  member.assignment
                    .ticketId,

                fromStatus:
                  TicketStatus.ON_SITE,

                toStatus:
                  TicketStatus.IN_PROGRESS,

                actorId:
                  user.id,

                metadata: {
                  assignmentMemberId:
                    member.id,

                  note:
                    dto.note,
                },
              },
            });
          }

          return tx.assignmentMember.findUniqueOrThrow({
            where: {
              id:
                member.id,
            },
          });
        },
      );

    await this.audit.write({
      actorUserId:
        user.id,

      action:
        'FIELD_WORK_STARTED',

      resourceType:
        'assignment_member',

      resourceId:
        memberId,

      after: {
        note:
          dto.note,
      },
    });

    return result;
  }

  async complete(
    memberId: string,
    dto: CompleteWorkDto,
    user: AuthUser,
  ) {
    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const member =
            await tx.assignmentMember.findFirst({
              where: {
                id:
                  memberId,

                technicianId:
                  user.id,

                endedAt:
                  null,

                assignment: {
                  is: {
                    status: AssignmentStatus.ACTIVE,
                  },
                },
              },

              include: {
                assignment: {
                  include: {
                    ticket:
                      true,
                  },
                },

                slaInstances: {
                  where: {
                    slaType:
                      SlaType.WORK,
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
                'Assignment tidak dapat diakses.',
            });
          }

          /*
           * Phase 6:
           * Jangan izinkan completion
           * selama ticket PENDING.
           */
          assertTechnicianOperational(
            member.assignment
              .ticket.status,
          );

          /*
           * Selesaikan hanya dari IN_PROGRESS.
           */
          if (
            member.status !==
            AssignmentMemberStatus.IN_PROGRESS
          ) {
            throw new ConflictException({
              code:
                'WORK_COMPLETE_NOT_ALLOWED',

              message:
                'Pekerjaan belum berada pada status yang dapat diselesaikan.',
            });
          }

          const workSla = member.slaInstances[0];

          if (!workSla) {
            throw new ConflictException({
              code: 'WORL_SLA_NOT_FOUND',
              message: 'SLA pengerjaan tidak ditemukan untuk pekerjaan ini. Completion tidak dapat diproses.',
              details: {
                assignmentMemberId: member.id,
                memberStatus: member.status,
                firstCheckinAt: member.firstCheckinAt,
              },
            });
          }

          /*
           * Phase 4 + Phase 6:
           *
           * - minimal 1 media
           * - multi-upload
           * - image/video
           * - media harus milik technician
           */
          const mediaAssets =
            await this.media.validateForContext(
              dto.mediaIds,

              MediaContext.COMPLETION,

              user.id,

              tx,
            );

          const now =
            new Date();

          const completion =
            await tx.workCompletion.create({
              data: {
                assignmentMemberId:
                  member.id,

                summary:
                  dto.summary,

                completedAt:
                  now,

                latitude:
                  dto.latitude,

                longitude:
                  dto.longitude,

                submittedById:
                  user.id,
              },
            });

          await tx.mediaLink.createMany({
            data:
              mediaAssets.map(
                (asset) => ({
                  mediaAssetId:
                    asset.id,

                  context:
                    MediaContext.COMPLETION,

                  assignmentMemberId:
                    member.id,

                  workCompletionId:
                    completion.id,
                }),
              ),
          });

          await tx.assignmentMember.update({
            where: {
              id:
                member.id,
            },

            data: {
              status:
                AssignmentMemberStatus.COMPLETED,

              completedAt:
                now,

              completionSummary:
                dto.summary,
            },
          });

          await this.sla.complete(
            workSla.id,
            now,
            tx,
          );

          await this.notifications.notifyRoles(
            [
              'ADMINISTRATOR',
              'HEAD',
            ],

            {
              type:
                NotificationType.TECHNICIAN_COMPLETED,

              title:
                'Pekerjaan teknisi selesai',

              body:
                `${user.displayName} menyelesaikan bagian ${member.assignment.ticket.ticketCode}.`,

              relatedType:
                'ticket',

              relatedId:
                member
                  .assignment
                  .ticketId,

              eventKey:
                `completion-${completion.id}`,
            },

            tx,
          );

          return completion;
        },
      );

    await this.audit.write({
      actorUserId:
        user.id,

      action:
        'FIELD_WORK_COMPLETED',

      resourceType:
        'work_completion',

      resourceId:
        result.id,

      after: {
        assignmentMemberId:
          memberId,

        summary:
          dto.summary,

        mediaIds:
          dto.mediaIds,
      },
    });

    return result;
  }

  async activity(
    memberId: string,
    user: AuthUser,
  ) {
    const member =
      await this.prisma.assignmentMember.findUnique({
        where: {
          id:
            memberId,
        },

        include: {
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
          },

          slaInstances:
            true,
        },
      });

    if (
      !member ||
      (
        !user.permissions.includes(
          'ticket.read.all',
        ) &&
        member.technicianId !==
        user.id
      )
    ) {
      throw new ForbiddenException({
        code:
          'ASSIGNMENT_ACCESS_DENIED',

        message:
          'Aktivitas tidak dapat diakses.',
      });
    }

    return {
      ...member,

      sla:
        member
          .slaInstances[0]
          ? this.sla.present(
            member
              .slaInstances[0],
          )
          : null,
    };
  }
}