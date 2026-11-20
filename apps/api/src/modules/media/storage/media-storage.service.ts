import {
    BadRequestException,
    Injectable,
} from '@nestjs/common';

import {
    ConfigService,
} from '@nestjs/config';

import {
    DirectUploadGrant,
    DirectUploadRequest,
    MediaAccessTarget,
    MediaStorageProvider,
    StoredObjectInspection,
} from '../media-storage.types';

import {
    LocalMediaStorageService,
} from '../local-media-storage.service';

import {
    VercelBlobMediaStorageService,
} from './vercel-blob-media-storage.service';

@Injectable()
export class MediaStorageService {
    constructor(
        private readonly config:
            ConfigService,

        private readonly local:
            LocalMediaStorageService,

        private readonly blob:
            VercelBlobMediaStorageService,
    ) { }

    currentProvider():
        MediaStorageProvider {
        const value =
            this.config
                .get<string>(
                    'MEDIA_STORAGE_PROVIDER',
                )
                ?.trim()
                .toUpperCase();

        if (
            !value ||
            value === 'LOCAL'
        ) {
            return 'LOCAL';
        }

        if (
            value === 'VERCEL_BLOB'
        ) {
            return 'VERCEL_BLOB';
        }

        /*
         * Seharusnya sudah ditangkap
         * validateEnvironment().
         */
        throw new Error(
            `MEDIA_STORAGE_PROVIDER tidak valid: ${value}`,
        );
    }

    isLocalMode():
        boolean {
        return (
            this.currentProvider() ===
            'LOCAL'
        );
    }

    async inspectLocalUpload(
        filePath: string,
    ): Promise<StoredObjectInspection> {
        return this.local
            .inspectUploadFile(
                filePath,
            );
    }

    async inspectStored(
        provider: string,
        providerPublicId: string,
    ): Promise<StoredObjectInspection> {
        if (
            provider === 'LOCAL'
        ) {
            return this.local
                .inspectStored(
                    providerPublicId,
                );
        }

        if (
            provider ===
            'VERCEL_BLOB'
        ) {
            return this.blob
                .inspectStored(
                    providerPublicId,
                );
        }

        throw new BadRequestException({
            code:
                'MEDIA_PROVIDER_UNSUPPORTED',

            message:
                'Media provider belum didukung sebagai evidence.',

            details: {
                provider,
            },
        });
    }

    async createDirectUpload(
        input: DirectUploadRequest,
    ): Promise<DirectUploadGrant> {
        if (
            this.currentProvider() !==
            'VERCEL_BLOB'
        ) {
            throw new BadRequestException({
                code:
                    'DIRECT_UPLOAD_NOT_AVAILABLE',

                message:
                    'Direct upload hanya tersedia ketika Vercel Blob aktif.',
            });
        }

        return this.blob
            .createDirectUpload(
                input,
            );
    }

    async access(
        provider: string,
        providerPublicId: string,
    ): Promise<MediaAccessTarget> {
        if (
            provider === 'LOCAL'
        ) {
            return this.local.access(
                providerPublicId,
            );
        }

        if (
            provider ===
            'VERCEL_BLOB'
        ) {
            return this.blob.access(
                providerPublicId,
            );
        }

        throw new BadRequestException({
            code:
                'MEDIA_PROVIDER_UNSUPPORTED',

            message:
                'Media provider belum didukung.',

            details: {
                provider,
            },
        });
    }

    async deleteLocalUpload(
        filePath: string,
    ): Promise<void> {
        await this.local
            .deleteUploadFile(
                filePath,
            );
    }

    async deleteStored(
        provider: string,
        providerPublicId: string,
    ): Promise<void> {
        if (
            provider ===
            'VERCEL_BLOB'
        ) {
            await this.blob.delete(
                providerPublicId,
            );
        }
    }
}