import {
    randomUUID,
} from 'node:crypto';

import {
    readdir,
} from 'node:fs/promises';

import {
    resolve,
} from 'node:path';

import {
    PrismaClient,
} from '@prisma/client';

import {
    del,
    get,
    put,
} from '@vercel/blob';

import nodemailer
    from 'nodemailer';

const API_ROOT =
    resolve(
        process.cwd(),
    );

const MIGRATIONS_DIR =
    resolve(
        API_ROOT,
        'prisma',
        'migrations',
    );

function required(
    name,
) {
    const value =
        process.env[name]
            ?.trim();

    if (!value) {
        throw new Error(
            `${name} wajib diisi.`,
        );
    }

    return value;
}

function parseBoolean(
    value,
    fallback,
) {
    if (
        value == null ||
        value.trim() === ''
    ) {
        return fallback;
    }

    return [
        '1',
        'true',
        'yes',
        'on',
    ].includes(
        value
            .trim()
            .toLowerCase(),
    );
}

function printStep(
    label,
    status,
    detail = '',
) {
    const suffix =
        detail
            ? ` - ${detail}`
            : '';

    console.log(
        `[${status}] ${label}${suffix}`,
    );
}

async function verifyDatabase() {
    const databaseUrl =
        required(
            'DATABASE_URL',
        );

    const directUrl =
        required(
            'DIRECT_URL',
        );

    const runtimeHost =
        new URL(
            databaseUrl,
        ).hostname;

    const directHost =
        new URL(
            directUrl,
        ).hostname;

    if (
        runtimeHost.includes(
            '.neon.tech',
        ) &&
        !runtimeHost.includes(
            '-pooler.',
        )
    ) {
        throw new Error(
            'DATABASE_URL Neon production harus menggunakan pooled hostname (-pooler).',
        );
    }

    if (
        directHost.includes(
            '.neon.tech',
        ) &&
        directHost.includes(
            '-pooler.',
        )
    ) {
        throw new Error(
            'DIRECT_URL Neon production harus menggunakan direct/non-pooler hostname.',
        );
    }

    const runtimePrisma =
        new PrismaClient({
            datasources: {
                db: {
                    url:
                        databaseUrl,
                },
            },
        });

    const directPrisma =
        new PrismaClient({
            datasources: {
                db: {
                    url:
                        directUrl,
                },
            },
        });

    try {
        await runtimePrisma
            .$queryRaw`
        SELECT 1
      `;

        printStep(
            'Neon pooled runtime connection',
            'OK',
            runtimeHost,
        );

        await directPrisma
            .$queryRaw`
        SELECT 1
      `;

        printStep(
            'Neon direct migration connection',
            'OK',
            directHost,
        );

        const migrationDirectories =
            (
                await readdir(
                    MIGRATIONS_DIR,
                    {
                        withFileTypes:
                            true,
                    },
                )
            )
                .filter(
                    (entry) =>
                        entry.isDirectory(),
                )
                .map(
                    (entry) =>
                        entry.name,
                )
                .sort();

        const appliedMigrations =
            await directPrisma
                .$queryRawUnsafe(`
          SELECT
            migration_name,
            finished_at,
            rolled_back_at
          FROM "_prisma_migrations"
          ORDER BY started_at ASC
        `);

        const failed =
            appliedMigrations
                .filter(
                    (migration) =>
                        migration
                            .finished_at ==
                        null &&
                        migration
                            .rolled_back_at ==
                        null,
                );

        if (
            failed.length > 0
        ) {
            throw new Error(
                `Ada migration production gagal/pending: ${failed
                    .map(
                        (
                            migration,
                        ) =>
                            migration
                                .migration_name,
                    )
                    .join(', ')}`,
            );
        }

        const appliedNames =
            new Set(
                appliedMigrations
                    .filter(
                        (migration) =>
                            migration
                                .finished_at !=
                            null,
                    )
                    .map(
                        (
                            migration,
                        ) =>
                            migration
                                .migration_name,
                    ),
            );

        const missing =
            migrationDirectories
                .filter(
                    (name) =>
                        !appliedNames.has(
                            name,
                        ),
                );

        if (
            missing.length > 0
        ) {
            throw new Error(
                `Migration belum diterapkan: ${missing.join(', ')}`,
            );
        }

        printStep(
            'Prisma migrations',
            'OK',
            `${migrationDirectories.length} migration(s) applied`,
        );

        const [
            demoTicketCount,
            demoClientCount,
            exampleUserCount,
        ] =
            await Promise.all([
                directPrisma
                    .ticket
                    .count({
                        where: {
                            ticketCode:
                                'TKT-DEMO01',
                        },
                    }),

                directPrisma
                    .client
                    .count({
                        where: {
                            code: {
                                in: [
                                    'CLIENT-DEMO',
                                    'CLIENT-SECOND',
                                ],
                            },
                        },
                    }),

                directPrisma
                    .user
                    .count({
                        where: {
                            email: {
                                endsWith:
                                    '@example.com',
                            },
                        },
                    }),
            ]);

        if (
            demoTicketCount > 0 ||
            demoClientCount > 0 ||
            exampleUserCount > 0
        ) {
            throw new Error(
                'Database production masih memiliki data demo.',
            );
        }

        printStep(
            'Production demo-data guard',
            'OK',
        );
    } finally {
        await Promise
            .allSettled([
                runtimePrisma
                    .$disconnect(),

                directPrisma
                    .$disconnect(),
            ]);
    }
}

async function readBlobText(
    stream,
) {
    return new Response(
        stream,
    ).text();
}

async function verifyBlob() {
    required(
        'BLOB_READ_WRITE_TOKEN',
    );

    const pathname =
        `infra-check/${Date.now()}-${randomUUID()}.txt`;

    const content =
        `ticketing-sla-blob-check:${new Date().toISOString()}`;

    let uploadedUrl =
        null;

    try {
        const uploaded =
            await put(
                pathname,
                content,
                {
                    access:
                        'private',

                    contentType:
                        'text/plain; charset=utf-8',

                    addRandomSuffix:
                        false,

                    allowOverwrite:
                        false,
                },
            );

        uploadedUrl =
            uploaded.url;

        const stored =
            await get(
                pathname,
                {
                    access:
                        'private',

                    useCache:
                        false,
                },
            );

        if (
            !stored ||
            !stored.stream
        ) {
            throw new Error(
                'Blob test object tidak dapat dibaca kembali.',
            );
        }

        const storedContent =
            await readBlobText(
                stored.stream,
            );

        if (
            storedContent !==
            content
        ) {
            throw new Error(
                'Isi Blob hasil read tidak sama dengan data yang di-upload.',
            );
        }

        printStep(
            'Vercel Blob private write/read',
            'OK',
            pathname,
        );
    } finally {
        if (
            uploadedUrl
        ) {
            await del(
                uploadedUrl,
            ).catch(
                () =>
                    undefined,
            );
        }
    }
}

async function verifySmtp() {
    const host =
        required(
            'SMTP_HOST',
        );

    const from =
        required(
            'SMTP_FROM',
        );

    const testTo =
        required(
            'SMTP_TEST_TO',
        );

    const port =
        Number(
            process.env
                .SMTP_PORT ||
            '587',
        );

    const user =
        process.env
            .SMTP_USER
            ?.trim();

    const pass =
        process.env
            .SMTP_PASS
            ?.trim();

    if (
        !Number.isInteger(
            port,
        ) ||
        port <= 0
    ) {
        throw new Error(
            'SMTP_PORT harus integer positif.',
        );
    }

    if (
        Boolean(user) !==
        Boolean(pass)
    ) {
        throw new Error(
            'SMTP_USER dan SMTP_PASS harus diisi berpasangan.',
        );
    }

    const secure =
        parseBoolean(
            process.env
                .SMTP_SECURE,
            port === 465,
        );

    const rejectUnauthorized =
        parseBoolean(
            process.env
                .SMTP_TLS_REJECT_UNAUTHORIZED,
            true,
        );

    const connectionTimeout =
        Number(
            process.env
                .SMTP_CONNECTION_TIMEOUT_MS ||
            '30000',
        );

    const transporter =
        nodemailer
            .createTransport({
                host,
                port,
                secure,

                auth:
                    user &&
                        pass
                        ? {
                            user,
                            pass,
                        }
                        : undefined,

                connectionTimeout,

                greetingTimeout:
                    connectionTimeout,

                socketTimeout:
                    connectionTimeout *
                    2,

                tls: {
                    rejectUnauthorized,
                },
            });

    await transporter
        .verify();

    printStep(
        'SMTP connection/authentication',
        'OK',
        `${host}:${port}`,
    );

    const info =
        await transporter
            .sendMail({
                from,

                to:
                    testTo,

                subject:
                    '[Ticketing SLA] Production SMTP test',

                text: [
                    'SMTP production Ticketing SLA berhasil terhubung.',

                    `Timestamp: ${new Date().toISOString()}`,

                    'Email ini dibuat oleh scripts/verify-production-infra.mjs.',
                ].join(
                    '\n',
                ),
            });

    printStep(
        'SMTP test email',
        'OK',

        info.messageId ||
        testTo,
    );
}

function verifySchedulerConfiguration() {
    const mode =
        required(
            'SLA_SCHEDULER_MODE',
        ).toUpperCase();

    const secret =
        required(
            'SLA_CRON_SECRET',
        );

    if (
        mode !==
        'EXTERNAL'
    ) {
        throw new Error(
            'Production harus menggunakan SLA_SCHEDULER_MODE=EXTERNAL.',
        );
    }

    if (
        secret.length <
        32
    ) {
        throw new Error(
            'SLA_CRON_SECRET minimal 32 karakter.',
        );
    }

    printStep(
        'External SLA scheduler configuration',
        'OK',
    );
}

async function main() {
    console.log(
        'Ticketing SLA - Production Infrastructure Verification',
    );

    console.log(
        '====================================================',
    );

    if (
        (
            process.env.APP_ENV ||
            ''
        )
            .trim()
            .toUpperCase() !==
        'PRODUCTION'
    ) {
        throw new Error(
            'APP_ENV harus PRODUCTION untuk menjalankan verification ini.',
        );
    }

    await verifyDatabase();

    await verifyBlob();

    await verifySmtp();

    verifySchedulerConfiguration();

    console.log(
        '====================================================',
    );

    console.log(
        'Semua infrastructure check Phase 2 berhasil.',
    );
}

main()
    .catch(
        (error) => {
            console.error(
                '[FAILED]',

                error instanceof Error
                    ? error.message
                    : error,
            );

            process.exitCode =
                1;
        },
    );