import {
    ConflictException,
    Injectable,
} from '@nestjs/common';

import {
    ConfigService,
} from '@nestjs/config';

import {
    open,
    stat,
    unlink,
} from 'fs/promises';

import {
    basename,
    resolve,
} from 'path';

import {
    MEDIA_HEADER_BYTES,
} from './media.constants';

import {
    MediaAccessTarget,
    StoredObjectInspection,
} from './media-storage.types';

@Injectable()
export class LocalMediaStorageService {
    constructor(
        private readonly config:
            ConfigService,
    ) { }

    async inspectUploadFile(
        filePath: string,
    ): Promise<StoredObjectInspection> {
        return this.inspectFile(
            filePath,
        );
    }

    async inspectStored(
        providerPublicId: string,
    ): Promise<StoredObjectInspection> {
        return this.inspectFile(
            this.localPath(
                providerPublicId,
            ),
        );
    }

    access(
        providerPublicId: string,
    ): MediaAccessTarget {
        return {
            kind:
                'LOCAL_FILE',

            path:
                this.localPath(
                    providerPublicId,
                ),
        };
    }

    async deleteUploadFile(
        filePath: string,
    ): Promise<void> {
        await this.safeDelete(
            filePath,
        );
    }

    private localPath(
        providerPublicId: string,
    ): string {
        /*
         * providerPublicId local hanya boleh filename,
         * bukan path traversal.
         */
        if (
            basename(
                providerPublicId,
            ) !==
            providerPublicId
        ) {
            throw new ConflictException({
                code:
                    'MEDIA_STORAGE_PATH_INVALID',

                message:
                    'Path media local tidak valid.',
            });
        }

        return resolve(
            this.uploadRoot(),
            providerPublicId,
        );
    }

    private uploadRoot():
        string {
        return resolve(
            this.config.get<string>(
                'UPLOAD_DIR',
            ) ??
            resolve(
                process.cwd(),
                'uploads',
            ),
        );
    }

    private async inspectFile(
        filePath: string,
    ): Promise<StoredObjectInspection> {
        let fileStat;

        try {
            fileStat =
                await stat(
                    filePath,
                );
        } catch {
            throw new ConflictException({
                code:
                    'MEDIA_FILE_UNAVAILABLE',

                message:
                    'File media tidak tersedia atau telah dihapus.',
            });
        }

        if (
            !fileStat.isFile()
        ) {
            throw new ConflictException({
                code:
                    'MEDIA_FILE_UNAVAILABLE',

                message:
                    'File media tidak tersedia atau telah dihapus.',
            });
        }

        const handle =
            await open(
                filePath,
                'r',
            );

        try {
            const buffer =
                Buffer.alloc(
                    MEDIA_HEADER_BYTES,
                );

            const {
                bytesRead,
            } =
                await handle.read(
                    buffer,
                    0,
                    buffer.length,
                    0,
                );

            return {
                sizeBytes:
                    fileStat.size,

                contentType:
                    null,

                header:
                    buffer.subarray(
                        0,
                        bytesRead,
                    ),
            };
        } finally {
            await handle.close();
        }
    }

    private async safeDelete(
        filePath: string,
    ): Promise<void> {
        try {
            await unlink(
                filePath,
            );
        } catch {
            /*
             * Cleanup best-effort.
             *
             * Error validation/database tidak boleh
             * tertimpa error cleanup.
             */
        }
    }
}
