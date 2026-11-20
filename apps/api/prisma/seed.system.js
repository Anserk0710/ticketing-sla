'use strict';

const permissions = [
    'auth.session.manage',
    'user.read',
    'user.manage',
    'technician.register',
    'technician.approve',
    'client.read',
    'client.manage',
    'site.read',
    'site.manage',
    'catalog.read',
    'catalog.manage',
    'sla.policy.read',
    'sla.policy.manage',
    'ticket.create.public',
    'ticket.track.public',
    'ticket.read.all',
    'ticket.read.assigned',
    'ticket.respond',
    'ticket.classify',
    'ticket.assign',
    'ticket.reassign',
    'ticket.resolve',
    'ticket.close',
    'ticket.reopen',
    'ticket.comment.internal',
    'field.checkin',
    'field.work.start',
    'field.work.complete',
    'media.read.internal',
    'report.read',
    'report.export',
    'notification.read.self',
    'audit.read',
];

const rolePermissions = {
    ADMINISTRATOR: [
        ...permissions,
    ],

    HEAD: [
        'user.read',
        'technician.approve',
        'client.read',
        'site.read',
        'catalog.read',
        'sla.policy.read',
        'ticket.create.public',
        'ticket.track.public',
        'ticket.read.all',
        'ticket.read.assigned',
        'ticket.respond',
        'ticket.classify',
        'ticket.assign',
        'ticket.reassign',
        'ticket.resolve',
        'ticket.close',
        'ticket.reopen',
        'ticket.comment.internal',
        'media.read.internal',
        'report.read',
        'report.export',
        'notification.read.self',
        'audit.read',
    ],

    TECHNICIAN: [
        'ticket.create.public',
        'ticket.track.public',
        'ticket.read.assigned',
        'field.checkin',
        'field.work.start',
        'field.work.complete',
        'media.read.internal',
        'notification.read.self',
    ],
};

const priorityData = [
    {
        code: 'CRITICAL',
        label: 'Critical',
        severityOrder: 1,
        respond: 900,
        work: 7200,
    },
    {
        code: 'HIGH',
        label: 'High',
        severityOrder: 2,
        respond: 1800,
        work: 14400,
    },
    {
        code: 'MEDIUM',
        label: 'Medium',
        severityOrder: 3,
        respond: 3600,
        work: 28800,
    },
    {
        code: 'LOW',
        label: 'Low',
        severityOrder: 4,
        respond: 14400,
        work: 86400,
    },
];

const categoryData = [
    {
        code: 'NETWORK',
        name:
            'Network & Internet',
        displayOrder: 1,
    },
    {
        code: 'HARDWARE',
        name:
            'Perangkat Keras',
        displayOrder: 2,
    },
    {
        code: 'SOFTWARE',
        name:
            'Aplikasi & Software',
        displayOrder: 3,
    },
    {
        code: 'OTHER',
        name: 'Lainnya',
        displayOrder: 4,
    },
];

const deprecatedPermissions = [
    'ticket.reject',
];

async function seedAccessControl(
    prisma,
) {
    for (
        const code of permissions
    ) {
        await prisma.permission.upsert({
            where: {
                code,
            },

            update: {},

            create: {
                code,
            },
        });
    }

    for (
        const roleName of
        Object.keys(
            rolePermissions,
        )
    ) {
        const role =
            await prisma.role.upsert({
                where: {
                    name: roleName,
                },

                update: {
                    description:
                        `Role ${roleName}`,
                },

                create: {
                    name: roleName,

                    description:
                        `Role ${roleName}`,
                },
            });

        const configuredPermissions =
            await prisma.permission
                .findMany({
                    where: {
                        code: {
                            in:
                                rolePermissions[
                                roleName
                                ],
                        },
                    },

                    select: {
                        id: true,
                        code: true,
                    },
                });

        const configuredPermissionIds =
            configuredPermissions.map(
                (permission) =>
                    permission.id,
            );

        /*
         * Role permission merupakan declarative config.
         *
         * Permission lama yang tidak lagi terdapat
         * pada configuration dihapus.
         */
        await prisma.rolePermission
            .deleteMany({
                where: {
                    roleId:
                        role.id,

                    permissionId: {
                        notIn:
                            configuredPermissionIds,
                    },
                },
            });

        for (
            const permission of
            configuredPermissions
        ) {
            await prisma.rolePermission
                .upsert({
                    where: {
                        roleId_permissionId: {
                            roleId:
                                role.id,

                            permissionId:
                                permission.id,
                        },
                    },

                    update: {},

                    create: {
                        roleId:
                            role.id,

                        permissionId:
                            permission.id,
                    },
                });
        }
    }

    await prisma.rolePermission
        .deleteMany({
            where: {
                permission: {
                    code: {
                        in:
                            deprecatedPermissions,
                    },
                },
            },
        });

    return prisma.role.findMany({
        where: {
            name: {
                in:
                    Object.keys(
                        rolePermissions,
                    ),
            },
        },
    });
}

async function seedCatalogAndSla(
    prisma,
    createdById = null,
) {
    const priorities = {};

    for (
        const item of
        priorityData
    ) {
        const priority =
            await prisma.ticketPriority
                .upsert({
                    where: {
                        code:
                            item.code,
                    },

                    update: {
                        label:
                            item.label,

                        severityOrder:
                            item.severityOrder,

                        isActive:
                            true,
                    },

                    create: {
                        code:
                            item.code,

                        label:
                            item.label,

                        severityOrder:
                            item.severityOrder,
                    },
                });

        priorities[
            item.code
        ] = priority;

        await prisma
            .slaPolicyVersion
            .upsert({
                where: {
                    priorityId_version: {
                        priorityId:
                            priority.id,

                        version:
                            1,
                    },
                },

                update: {
                    respondTargetSeconds:
                        item.respond,

                    workTargetSeconds:
                        item.work,

                    warningThresholdPercent:
                        75,

                    calculationMode:
                        'CALENDAR_24_7',

                    createdById,
                },

                create: {
                    priorityId:
                        priority.id,

                    version:
                        1,

                    respondTargetSeconds:
                        item.respond,

                    workTargetSeconds:
                        item.work,

                    warningThresholdPercent:
                        75,

                    calculationMode:
                        'CALENDAR_24_7',

                    effectiveFrom:
                        new Date(
                            '2026-01-01T00:00:00.000Z',
                        ),

                    createdById,
                },
            });
    }

    const categories = {};

    for (
        const item of
        categoryData
    ) {
        categories[
            item.code
        ] =
            await prisma
                .ticketCategory
                .upsert({
                    where: {
                        code:
                            item.code,
                    },

                    update: {
                        name:
                            item.name,

                        displayOrder:
                            item.displayOrder,

                        isActive:
                            true,
                    },

                    create: {
                        code:
                            item.code,

                        name:
                            item.name,

                        displayOrder:
                            item.displayOrder,
                    },
                });
    }

    return {
        priorities,
        categories,
    };
}

module.exports = {
    permissions,
    rolePermissions,
    priorityData,
    categoryData,
    seedAccessControl,
    seedCatalogAndSla,
};