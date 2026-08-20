'use strict';

const { PrismaClient, TicketStatus, UserStatus, SlaType, SlaStatus, SlaOutcome, AssignmentMemberStatus } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const permissions = [
  'auth.session.manage', 'user.read', 'user.manage', 'technician.register', 'technician.approve',
  'client.read', 'client.manage', 'site.read', 'site.manage', 'catalog.read', 'catalog.manage',
  'sla.policy.read', 'sla.policy.manage', 'ticket.create.public', 'ticket.track.public',
  'ticket.read.all', 'ticket.read.assigned', 'ticket.respond', 'ticket.classify', 'ticket.assign',
  'ticket.reassign', 'ticket.resolve', 'ticket.close', 'ticket.reopen',
  'ticket.comment.internal', 'field.checkin', 'field.work.start', 'field.work.complete',
  'media.read.internal', 'report.read', 'report.export', 'notification.read.self', 'audit.read'
];

const rolePermissions = {
  ADMINISTRATOR: [...permissions],
  HEAD: [
    'user.read', 'technician.approve', 'client.read', 'site.read', 'catalog.read', 'sla.policy.read',
    'ticket.create.public', 'ticket.track.public', 'ticket.read.all', 'ticket.read.assigned',
    'ticket.respond', 'ticket.classify', 'ticket.assign', 'ticket.reassign',
    'ticket.resolve', 'ticket.close', 'ticket.reopen', 'ticket.comment.internal', 'media.read.internal',
    'report.read', 'report.export', 'notification.read.self', 'audit.read'
  ],
  TECHNICIAN: [
    'ticket.create.public', 'ticket.track.public', 'ticket.read.assigned', 'field.checkin',
    'field.work.start', 'field.work.complete', 'media.read.internal',
    'notification.read.self'
  ]
};

const deprecatedPermissions = ['ticket.reject'];

async function upsertUser(input) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      displayName: input.displayName,
      passwordHash,
      status: input.status ?? UserStatus.APPROVED,
      phoneNormalized: input.phone
    },
    create: {
      email: input.email,
      displayName: input.displayName,
      passwordHash,
      status: input.status ?? UserStatus.APPROVED,
      phoneNormalized: input.phone
    }
  });
  const role = await prisma.role.findUniqueOrThrow({ where: { name: input.role } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id }
  });
  if (input.role === 'TECHNICIAN') {
    await prisma.technicianProfile.upsert({
      where: { userId: user.id },
      update: {
        employeeCode: input.employeeCode,
        isAvailable: true,
        approvedAt: (input.status ?? UserStatus.APPROVED) === UserStatus.APPROVED ? new Date() : null
      },
      create: {
        userId: user.id,
        employeeCode: input.employeeCode,
        skills: ['Network', 'Hardware'],
        isAvailable: true,
        approvedAt: (input.status ?? UserStatus.APPROVED) === UserStatus.APPROVED ? new Date() : null
      }
    });
  }
  return user;
}

async function main() {
  for (const code of permissions) {
    await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
  }

  for (const roleName of ['ADMINISTRATOR', 'HEAD', 'TECHNICIAN']) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: `Role ${roleName}` }
    });
    for (const code of rolePermissions[roleName]) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id }
      });
    }
  }

  await prisma.rolePermission.deleteMany({
    where: { permission: { code: { in: deprecatedPermissions } } }
  });

  /*
   * Phase 6 / C-02:
   *
   * Technician hanya menjalankan:
   * - accept
   * - check-in
   * - start work
   * - complete
   *
   * Resolve merupakan keputusan Head/Administrator.
   *
   * Menghapus permission dari rolePermissions saja tidak cukup
   * karena seed menggunakan upsert dan mapping lama di database
   * akan tetap ada.
   */
  const technicianRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'TECHNICIAN' },
  });

  const resolvePermission = await prisma.permission.findUniqueOrThrow({
    where: { code: 'ticket.resolve' },
  });

  await prisma.rolePermission.deleteMany({
    where: {
      roleId: technicianRole.id,
      permissionId: resolvePermission.id,
    },
  });

  const admin = await upsertUser({ email: 'forfun071020@gmail.com', displayName: 'System Administrator', password: 'Admin123!', role: 'ADMINISTRATOR', phone: '628111111111' });
  const head = await upsertUser({ email: 'head@example.com', displayName: 'Operational Head', password: 'Head123!', role: 'HEAD', phone: '628122222222' });
  const tech1 = await upsertUser({ email: 'tech1@example.com', displayName: 'Budi Teknisi', password: 'Tech123!', role: 'TECHNICIAN', phone: '628133333333', employeeCode: 'TECH-001' });
  const tech2 = await upsertUser({ email: 'tech2@example.com', displayName: 'Sari Teknisi', password: 'Tech123!', role: 'TECHNICIAN', phone: '628144444444', employeeCode: 'TECH-002' });
  await upsertUser({ email: 'tech3@example.com', displayName: 'Andi Teknisi', password: 'Tech123!', role: 'TECHNICIAN', phone: '628155555555', employeeCode: 'TECH-003' });
  await upsertUser({ email: 'pending@example.com', displayName: 'Teknisi Menunggu Approval', password: 'Tech123!', role: 'TECHNICIAN', status: UserStatus.PENDING_APPROVAL, phone: '628166666666', employeeCode: 'TECH-PENDING' });

  const priorityData = [
    { code: 'CRITICAL', label: 'Critical', severityOrder: 1, respond: 900, work: 7200 },
    { code: 'HIGH', label: 'High', severityOrder: 2, respond: 1800, work: 14400 },
    { code: 'MEDIUM', label: 'Medium', severityOrder: 3, respond: 3600, work: 28800 },
    { code: 'LOW', label: 'Low', severityOrder: 4, respond: 14400, work: 86400 }
  ];
  const priorities = {};
  for (const item of priorityData) {
    const priority = await prisma.ticketPriority.upsert({
      where: { code: item.code },
      update: { label: item.label, severityOrder: item.severityOrder },
      create: { code: item.code, label: item.label, severityOrder: item.severityOrder }
    });
    priorities[item.code] = priority;
    await prisma.slaPolicyVersion.upsert({
      where: { priorityId_version: { priorityId: priority.id, version: 1 } },
      update: { respondTargetSeconds: item.respond, workTargetSeconds: item.work, warningThresholdPercent: 75 },
      create: {
        priorityId: priority.id,
        version: 1,
        respondTargetSeconds: item.respond,
        workTargetSeconds: item.work,
        warningThresholdPercent: 75,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        createdById: admin.id
      }
    });
  }

  const categories = {};
  for (const [index, item] of ['NETWORK:Network & Internet', 'HARDWARE:Perangkat Keras', 'SOFTWARE:Aplikasi & Software', 'OTHER:Lainnya'].entries()) {
    const [code, name] = item.split(':');
    categories[code] = await prisma.ticketCategory.upsert({
      where: { code }, update: { name, displayOrder: index + 1 }, create: { code, name, displayOrder: index + 1 }
    });
  }

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
      await prisma.slaInstance.create({
        data: {
          slaType: SlaType.WORK, assignmentMemberId: member.id, serviceCycleNo: 1, policyVersionId: policy.id,
          prioritySnapshot: 'HIGH', targetSeconds: policy.workTargetSeconds, warningThresholdPercent: 75,
          startedAt: assignedAt, warningAt: new Date(assignedAt.getTime() + policy.workTargetSeconds * 0.75 * 1000),
          dueAt: new Date(assignedAt.getTime() + policy.workTargetSeconds * 1000), status: SlaStatus.OPEN
        }
      });
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
