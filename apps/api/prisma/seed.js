'use strict';

const {
  PrismaClient,
  TicketStatus,
  UserStatus,
  SlaType,
  SlaStatus,
  SlaOutcome,
  AssignmentMemberStatus,
} = require(
  '@prisma/client',
);

const bcrypt =
  require(
    'bcryptjs',
  );

const {
  seedAccessControl,
  seedCatalogAndSla,
} = require(
  './seed.system',
);

const prisma =
  new PrismaClient();

async function upsertUser(
  input,
) {
  const passwordHash =
    await bcrypt.hash(
      input.password,
      12,
    );

  const user =
    await prisma.user.upsert({
      where: {
        email:
          input.email,
      },

      update: {
        displayName:
          input.displayName,

        passwordHash,

        status:
          input.status ??
          UserStatus.APPROVED,

        phoneNormalized:
          input.phone,
      },

      create: {
        email:
          input.email,

        displayName:
          input.displayName,

        passwordHash,

        status:
          input.status ??
          UserStatus.APPROVED,

        phoneNormalized:
          input.phone,
      },
    });

  const role =
    await prisma.role
      .findUniqueOrThrow({
        where: {
          name:
            input.role,
        },
      });

  await prisma.userRole
    .upsert({
      where: {
        userId_roleId: {
          userId:
            user.id,

          roleId:
            role.id,
        },
      },

      update: {},

      create: {
        userId:
          user.id,

        roleId:
          role.id,
      },
    });

  if (
    input.role ===
    'TECHNICIAN'
  ) {
    await prisma
      .technicianProfile
      .upsert({
        where: {
          userId:
            user.id,
        },

        update: {
          employeeCode:
            input.employeeCode,

          isAvailable:
            true,

          approvedAt:
            (
              input.status ??
              UserStatus.APPROVED
            ) ===
              UserStatus.APPROVED
              ? new Date()
              : null,
        },

        create: {
          userId:
            user.id,

          employeeCode:
            input.employeeCode,

          skills: [
            'Network',
            'Hardware',
          ],

          isAvailable:
            true,

          approvedAt:
            (
              input.status ??
              UserStatus.APPROVED
            ) ===
              UserStatus.APPROVED
              ? new Date()
              : null,
        },
      });
  }

  return user;
}

async function main() {
  await seedAccessControl(
    prisma,
  );

  const admin =
    await upsertUser({
      email:
        'forfun071020@gmail.com',

      displayName:
        'System Administrator',

      password:
        'Admin123!',

      role:
        'ADMINISTRATOR',

      phone:
        '628111111111',
    });

  const head =
    await upsertUser({
      email:
        'head@example.com',

      displayName:
        'Operational Head',

      password:
        'Head123!',

      role:
        'HEAD',

      phone:
        '628122222222',
    });

  const tech1 =
    await upsertUser({
      email:
        'tech1@example.com',

      displayName:
        'Budi Teknisi',

      password:
        'Tech123!',

      role:
        'TECHNICIAN',

      phone:
        '628133333333',

      employeeCode:
        'TECH-001',
    });

  const tech2 =
    await upsertUser({
      email:
        'tech2@example.com',

      displayName:
        'Sari Teknisi',

      password:
        'Tech123!',

      role:
        'TECHNICIAN',

      phone:
        '628144444444',

      employeeCode:
        'TECH-002',
    });

  await upsertUser({
    email:
      'tech3@example.com',

    displayName:
      'Andi Teknisi',

    password:
      'Tech123!',

    role:
      'TECHNICIAN',

    phone:
      '628155555555',

    employeeCode:
      'TECH-003',
  });

  await upsertUser({
    email:
      'pending@example.com',

    displayName:
      'Teknisi Menunggu Approval',

    password:
      'Tech123!',

    role:
      'TECHNICIAN',

    status:
      UserStatus.PENDING_APPROVAL,

    phone:
      '628166666666',

    employeeCode:
      'TECH-PENDING',
  });

  const {
    priorities,
    categories,
  } =
    await seedCatalogAndSla(
      prisma,
      admin.id,
    );

  /*
   * Dari titik ini lanjutkan code existing Anda
   * mulai:
   *
   * const client = await prisma.client.upsert(...)
   *
   * sampai akhir file.
   *
   * Hapus block lama yang membuat:
   * - permissions
   * - rolePermissions
   * - priorityData
   * - categories
   *
   * karena sudah dipindahkan ke seed.system.js.
   */

  const client = await prisma.client.upsert({
    where: { code: 'CLIENT-DEMO' },
    update: { name: 'PT Client Demo' },
    create: { code: 'CLIENT-DEMO', name: 'PT Client Demo', contactMetadata: { email: 'pic@client.demo' } }
  });
  const client2 = await prisma.client.upsert({
    where: { code: 'CLIENT-SECOND' },
    update: { name: 'CV Nusantara' },
    create: { code: 'CLIENT-SECOND', name: 'CV Nusantara' }
  });
  const site = await prisma.site.upsert({
    where: { code: 'SITE-DEMO' },
    update: { name: 'Kantor Utama Makassar' },
    create: {
      clientId: client.id, code: 'SITE-DEMO', name: 'Kantor Utama Makassar',
      address: 'Jl. AP Pettarani, Makassar', latitude: -5.147665, longitude: 119.432732,
      allowedCheckinRadius: 500, timezone: 'Asia/Makassar'
    }
  });
  await prisma.site.upsert({
    where: { code: 'SITE-GOWA' },
    update: { name: 'Cabang Gowa' },
    create: { clientId: client2.id, code: 'SITE-GOWA', name: 'Cabang Gowa', address: 'Sungguminasa, Gowa', timezone: 'Asia/Makassar' }
  });
  await prisma.qrCode.upsert({
    where: { token: 'DEMO-SITE-QR' }, update: { siteId: site.id, isActive: true },
    create: { token: 'DEMO-SITE-QR', siteId: site.id, createdById: admin.id }
  });

  const demoCode = 'TKT-DEMO01';
  const existing = await prisma.ticket.findUnique({ where: { ticketCode: demoCode } });
  if (!existing) {
    const createdAt = new Date(Date.now() - 45 * 60 * 1000);
    const policy = await prisma.slaPolicyVersion.findFirstOrThrow({ where: { priorityId: priorities.HIGH.id }, orderBy: { version: 'desc' } });
    const respondedAt = new Date(createdAt.getTime() + 15 * 60 * 1000);
    const warningAt = new Date(createdAt.getTime() + policy.respondTargetSeconds * 0.75 * 1000);
    const dueAt = new Date(createdAt.getTime() + policy.respondTargetSeconds * 1000);
    const ticket = await prisma.ticket.create({
      data: {
        ticketCode: demoCode, siteId: site.id, reporterName: 'Rahmat', picName: 'Ibu Maya',
        contactPhoneNormalized: '628171111111', categoryId: categories.NETWORK.id,
        priorityId: priorities.HIGH.id, description: 'Koneksi internet utama terputus.',
        status: TicketStatus.ASSIGNED, firstRespondedAt: respondedAt, createdAt
      }
    });
    await prisma.ticketStatusLog.createMany({
      data: [
        { ticketId: ticket.id, toStatus: TicketStatus.NEW, createdAt },
        { ticketId: ticket.id, fromStatus: TicketStatus.NEW, toStatus: TicketStatus.RESPONDED, actorId: head.id, createdAt: respondedAt },
        { ticketId: ticket.id, fromStatus: TicketStatus.RESPONDED, toStatus: TicketStatus.ASSIGNED, actorId: head.id, createdAt: new Date(respondedAt.getTime() + 5 * 60 * 1000) }
      ]
    });
    await prisma.ticketResponse.create({ data: { ticketId: ticket.id, type: 'OFFICIAL_INITIAL_RESPONSE', message: 'Keluhan diterima. Tim teknis segera menuju lokasi.', createdById: head.id, createdAt: respondedAt } });
    await prisma.slaInstance.create({
      data: {
        slaType: SlaType.RESPOND, ticketId: ticket.id, serviceCycleNo: 1, policyVersionId: policy.id,
        prioritySnapshot: 'HIGH', targetSeconds: policy.respondTargetSeconds, warningThresholdPercent: 75,
        startedAt: createdAt, warningAt, dueAt, completedAt: respondedAt, status: SlaStatus.COMPLETED, outcome: SlaOutcome.MET
      }
    });
    const assignedAt = new Date(respondedAt.getTime() + 5 * 60 * 1000);
    const assignment = await prisma.ticketAssignment.create({ data: { ticketId: ticket.id, serviceCycleNo: 1, assignedById: head.id, assignedAt, note: 'Periksa koneksi router dan ISP.' } });
    for (const [index, technician] of [tech1, tech2].entries()) {
      const member = await prisma.assignmentMember.create({ data: { assignmentId: assignment.id, technicianId: technician.id, isLead: index === 0, assignedAt, status: AssignmentMemberStatus.ASSIGNED } });
      await prisma.notification.upsert({
        where: { uniqueEventKey: `assignment-new-${member.id}` }, update: {},
        create: { recipientUserId: technician.id, type: 'ASSIGNMENT_NEW', title: 'Assignment baru', body: `Anda ditugaskan pada ${demoCode}.`, relatedType: 'assignment_member', relatedId: member.id, uniqueEventKey: `assignment-new-${member.id}` }
      });
    }
  }

  console.log('Seed selesai. Akun demo siap digunakan.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
