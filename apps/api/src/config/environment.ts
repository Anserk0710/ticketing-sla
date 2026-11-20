export type AppEnvironment =
    | 'DEVELOPMENT'
    | 'PRODUCTION';

export type MediaStorageProvider =
    | 'LOCAL'
    | 'VERCEL_BLOB';

export type SlaSchedulerMode =
    | 'INTERNAL'
    | 'EXTERNAL';

const MIN_SECRET_LENGTH = 32;

const DEFAULT_INTERNAL_SLA_INTERVAL_MS =
    60_000;

const MIN_INTERNAL_SLA_INTERVAL_MS =
    10_000;

function normalizedEnum<
    T extends string,
>(
    value: unknown,
    allowedValues: readonly T[],
    fallback: T,
    variableName: string,
): T {
    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ''
    ) {
        return fallback;
    }

    const normalized =
        String(value)
            .trim()
            .toUpperCase() as T;

    if (
        !allowedValues.includes(
            normalized,
        )
    ) {
        throw new Error(
            `${variableName} harus salah satu dari: ${allowedValues.join(', ')}.`,
        );
    }

    return normalized;
}

function parseInternalInterval(
    value: unknown,
): number {
    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ''
    ) {
        return DEFAULT_INTERNAL_SLA_INTERVAL_MS;
    }

    const intervalMs =
        Number(value);

    if (
        !Number.isInteger(intervalMs) ||
        intervalMs <
        MIN_INTERNAL_SLA_INTERVAL_MS
    ) {
        throw new Error(
            `SLA_INTERNAL_INTERVAL_MS harus integer minimal ${MIN_INTERNAL_SLA_INTERVAL_MS}.`,
        );
    }

    return intervalMs;
}

function parseBoolean(
    value: unknown,
    fallback: boolean,
    variableName: string,
): boolean {
    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ''
    ) {
        return fallback;
    }

    const normalized =
        String(value)
            .trim()
            .toLowerCase();

    if (
        [
            '1',
            'true',
            'yes',
            'on',
        ].includes(
            normalized,
        )
    ) {
        return true;
    }

    if (
        [
            '0',
            'false',
            'no',
            'off',
        ].includes(
            normalized,
        )
    ) {
        return false;
    }

    throw new Error(
        `${variableName} harus boolean true/false.`,
    );
}

function parsePositiveInteger(
    value: unknown,
    fallback: number,
    variableName: string,
): number {
    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ''
    ) {
        return fallback;
    }

    const parsed =
        Number(value);

    if (
        !Number.isInteger(
            parsed,
        ) ||
        parsed <= 0
    ) {
        throw new Error(
            `${variableName} harus integer positif.`,
        );
    }

    return parsed;
}

function requiredString(
    input: Record<string, unknown>,
    name: string,
): string {
    const value =
        String(
            input[name] ?? '',
        ).trim();

    if (!value) {
        throw new Error(
            `${name} wajib diisi.`,
        );
    }

    return value;
}

function assertMinimumSecret(
    input: Record<string, unknown>,
    name: string,
): void {
    const secret =
        requiredString(
            input,
            name,
        );

    if (
        secret.length <
        MIN_SECRET_LENGTH
    ) {
        throw new Error(
            `${name} wajib minimal ${MIN_SECRET_LENGTH} karakter.`,
        );
    }
}

function assertHttpUrl(
    value: string,
    name: string,
    production: boolean,
): void {
    let parsed: URL;

    try {
        parsed =
            new URL(value);
    } catch {
        throw new Error(
            `${name} harus berupa URL yang valid.`,
        );
    }

    if (
        ![
            'http:',
            'https:',
        ].includes(
            parsed.protocol,
        )
    ) {
        throw new Error(
            `${name} hanya mendukung protocol http/https.`,
        );
    }

    if (
        production &&
        parsed.protocol !== 'https:'
    ) {
        throw new Error(
            `${name} production wajib menggunakan HTTPS.`,
        );
    }
}

function assertSmtpConfiguration(
    input: Record<string, unknown>,
): void {
    const host =
        requiredString(
            input,
            'SMTP_HOST',
        );

    const from =
        requiredString(
            input,
            'SMTP_FROM',
        );

    const port =
        Number(
            input.SMTP_PORT ??
            587,
        );

    const user =
        String(
            input.SMTP_USER ?? '',
        ).trim();

    const pass =
        String(
            input.SMTP_PASS ?? '',
        ).trim();

    if (
        !host ||
        !from
    ) {
        throw new Error(
            'SMTP_HOST dan SMTP_FROM wajib diisi untuk production.',
        );
    }

    if (
        !Number.isInteger(port) ||
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
}

export function validateEnvironment(
    input: Record<
        string,
        unknown
    >,
): Record<
    string,
    unknown
> {
    const appEnvironment =
        normalizedEnum<AppEnvironment>(
            input.APP_ENV,
            [
                'DEVELOPMENT',
                'PRODUCTION',
            ],
            'DEVELOPMENT',
            'APP_ENV',
        );

    const swaggerEnabled =
        parseBoolean(
            input.SWAGGER_ENABLED,

            /*
             * Development = Swagger aktif.
             * Production  = Swagger mati.
             */
            appEnvironment !==
            'PRODUCTION',

            'SWAGGER_ENABLED',
        );

    const slowRequestThresholdMs =
        parsePositiveInteger(
            input.SLOW_REQUEST_THRESHOLD_MS,
            1500,
            'SLOW_REQUEST_THRESHOLD_MS',
        );

    const mediaStorageProvider =
        normalizedEnum<MediaStorageProvider>(
            input.MEDIA_STORAGE_PROVIDER,
            [
                'LOCAL',
                'VERCEL_BLOB',
            ],
            'LOCAL',
            'MEDIA_STORAGE_PROVIDER',
        );

    const slaSchedulerMode =
        normalizedEnum<SlaSchedulerMode>(
            input.SLA_SCHEDULER_MODE,
            [
                'INTERNAL',
                'EXTERNAL',
            ],
            'INTERNAL',
            'SLA_SCHEDULER_MODE',
        );

    const slaInternalIntervalMs =
        parseInternalInterval(
            input.SLA_INTERNAL_INTERVAL_MS,
        );

    if (
        slaSchedulerMode ===
        'EXTERNAL'
    ) {
        assertMinimumSecret(
            input,
            'SLA_CRON_SECRET',
        );
    }

    if (
        mediaStorageProvider ===
        'VERCEL_BLOB'
    ) {
        const storeId =
            String(
                input.BLOB_STORE_ID ??
                '',
            ).trim();

        const readWriteToken =
            String(
                input.BLOB_READ_WRITE_TOKEN ??
                '',
            ).trim();

        if (
            !storeId &&
            !readWriteToken
        ) {
            throw new Error(
                'MEDIA_STORAGE_PROVIDER=VERCEL_BLOB membutuhkan BLOB_STORE_ID atau BLOB_READ_WRITE_TOKEN.',
            );
        }
    }

    /*
     * NODE_ENV tetap bisa production di Docker development.
     *
     * APP_ENV adalah pembeda environment bisnis:
     *
     * Docker development:
     * APP_ENV=DEVELOPMENT
     *
     * Vercel production:
     * APP_ENV=PRODUCTION
     */
    if (
        appEnvironment ===
        'PRODUCTION'
    ) {
        requiredString(
            input,
            'DATABASE_URL',
        );

        assertMinimumSecret(
            input,
            'JWT_ACCESS_SECRET',
        );

        assertMinimumSecret(
            input,
            'JWT_REFRESH_SECRET',
        );

        const publicWebUrl =
            requiredString(
                input,
                'PUBLIC_WEB_URL',
            );

        const emailWebBaseUrl =
            requiredString(
                input,
                'EMAIL_WEB_BASE_URL',
            );

        for (
            const origin of
            publicWebUrl
                .split(',')
                .map(
                    (value) =>
                        value.trim(),
                )
                .filter(Boolean)
        ) {
            assertHttpUrl(
                origin,
                'PUBLIC_WEB_URL',
                true,
            );
        }

        assertHttpUrl(
            emailWebBaseUrl,
            'EMAIL_WEB_BASE_URL',
            true,
        );

        if (
            mediaStorageProvider !==
            'VERCEL_BLOB'
        ) {
            throw new Error(
                'APP_ENV=PRODUCTION wajib menggunakan MEDIA_STORAGE_PROVIDER=VERCEL_BLOB.',
            );
        }

        if (
            slaSchedulerMode !==
            'EXTERNAL'
        ) {
            throw new Error(
                'APP_ENV=PRODUCTION wajib menggunakan SLA_SCHEDULER_MODE=EXTERNAL.',
            );
        }

        assertSmtpConfiguration(
            input,
        );
    }

    return {
        ...input,

        APP_ENV:
            appEnvironment,

        MEDIA_STORAGE_PROVIDER:
            mediaStorageProvider,

        SLA_SCHEDULER_MODE:
            slaSchedulerMode,

        SLA_INTERNAL_INTERVAL_MS:
            slaInternalIntervalMs,

        SWAGGER_ENABLED:
            swaggerEnabled,

        SLOW_REQUEST_THRESHOLD_MS:
            slowRequestThresholdMs,
    };
}