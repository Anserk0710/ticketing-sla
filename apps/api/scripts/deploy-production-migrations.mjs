import {
    spawnSync,
} from 'node:child_process';
import {
    createRequire,
} from 'node:module';

for (
    const name of [
        'DATABASE_URL',
        'DIRECT_URL',
    ]
) {
    if (
        !process.env[name]
            ?.trim()
    ) {
        console.error(
            `${name} wajib diisi sebelum production migration.`,
        );

        process.exit(
            1,
        );
    }
}

const require =
    createRequire(
        import.meta.url,
    );

const prismaCli =
    require.resolve(
        'prisma/build/index.js',
    );

/*
 * Prisma schema tetap menggunakan DATABASE_URL.
 *
 * Khusus migration production,
 * child process menerima DIRECT_URL sebagai DATABASE_URL.
 *
 * Artinya:
 *
 * Runtime Vercel -> pooled DATABASE_URL
 * Prisma migrate -> direct DIRECT_URL
 *
 * DIRECT_URL tidak perlu disimpan di Vercel runtime.
 */
const result =
    spawnSync(
        process.execPath,

        [
            prismaCli,
            'migrate',
            'deploy',
            '--schema',
            'prisma/schema.prisma',
        ],

        {
            stdio:
                'inherit',

            env: {
                ...process.env,

                DATABASE_URL:
                    process.env
                        .DIRECT_URL,
            },
        },
    );

if (
    result.error
) {
    console.error(
        result.error,
    );

    process.exit(
        1,
    );
}

process.exit(
    result.status ??
    1,
);
