import {
    ConflictException,
    Injectable,
} from '@nestjs/common';

import {
    del,
    get,
    issueSignedToken,
    presignUrl,
} from '@vercel/blob';

import {
    MEDIA_ACCESS_URL_TTL_MS,
    MEDIA_HEADER_BYTES,
} from '../media.constants';

import {
    DirectUploadGrant,
    DirectUploadRequest,
    MediaAccessTarget,
    StoredObjectInspection,
} from '../media-storage.types';

@Injectable()
export class VercelBlobMediaStorageService {
    /*
     * Backend hanya membuat signed URL kecil.
     *
     * Binary file tidak masuk ke NestJS/Vercel Function.
     */
    async createDirectUpload(
        input: DirectUploadRequest,
    ): Promise<DirectUploadGrant> {
        const signedToken =
            await issueSignedToken({
                pathname:
                    input.pathname,

                operations: [
                    'put',
                ],

                validUntil:
                    input.validUntil,

                allowedContentTypes: [
                    input.contentType,
                ],

                maximumSizeInBytes:
                    input.maximumSizeInBytes,
            });

        const {
            presignedUrl,
        } =
            await presignUrl(
                signedToken,
                {
                    pathname:
                        input.pathname,

                    operation:
                        'put',

                    access:
                        'private',

                    validUntil:
                        input.validUntil,

                    allowedContentTypes: [
                        input.contentType,
                    ],

                    maximumSizeInBytes:
                        input.maximumSizeInBytes,

                    addRandomSuffix:
                        false,

                    allowOverwrite:
                        false,
                },
            );

        return {
            provider:
                'VERCEL_BLOB',

            uploadMethod:
                'PRESIGNED_PUT',

            uploadUrl:
                presignedUrl,

            providerPublicId:
                input.pathname,

            expiresAt:
                new Date(
                    input.validUntil,
                ),
        };
    }

    /*
     * Hanya membaca 8 KB pertama untuk magic-byte validation.
     *
     * Ini lebih hemat daripada mendownload file video 100 MB
     * hanya untuk memeriksa signature.
     */
    async inspectStored(
        providerPublicId: string,
    ): Promise<StoredObjectInspection> {
        let object;

        try {
            object =
                await get(
                    providerPublicId,
                    {
                        access:
                            'private',

                        useCache:
                            false,

                        headers: {
                            Range:
                                `bytes=0-${MEDIA_HEADER_BYTES - 1}`,
                        },
                    },
                );
        } catch {
            throw this.unavailable(
                providerPublicId,
            );
        }

        if (
            !object ||
            !object.stream
        ) {
            throw this.unavailable(
                providerPublicId,
            );
        }

        /*
         * Karena request memakai Range, content-length
         * hanya berisi panjang range.
         *
         * Total ukuran asli berada di Content-Range:
         *
         * bytes 0-8191/12345678
         */
        const contentRange =
            object.headers.get(
                'content-range',
            );

        const totalSize =
            this.totalSizeFromContentRange(
                contentRange,
            );

        return {
            sizeBytes:
                totalSize ??
                object.blob.size,

            contentType:
                object.blob.contentType,

            header:
                await this.readPrefix(
                    object.stream,
                    MEDIA_HEADER_BYTES,
                ),
        };
    }

    /*
     * Generate URL GET sementara.
     *
     * User tetap harus melewati permission Backend
     * sebelum menerima signed URL tersebut.
     */
    async access(
        providerPublicId: string,
    ): Promise<MediaAccessTarget> {
        const validUntil =
            Date.now() +
            MEDIA_ACCESS_URL_TTL_MS;

        const signedToken =
            await issueSignedToken({
                pathname:
                    providerPublicId,

                operations: [
                    'get',
                ],

                validUntil,
            });

        const {
            presignedUrl,
        } =
            await presignUrl(
                signedToken,
                {
                    pathname:
                        providerPublicId,

                    operation:
                        'get',

                    access:
                        'private',

                    validUntil,

                    useCache:
                        false,
                },
            );

        return {
            kind:
                'REDIRECT',

            url:
                presignedUrl,
        };
    }

    async delete(
        providerPublicId: string,
    ): Promise<void> {
        try {
            await del(
                providerPublicId,
            );
        } catch {
            /*
             * Cleanup best-effort.
             */
        }
    }

    private totalSizeFromContentRange(
        value: string | null,
    ): number | null {
        if (!value) {
            return null;
        }

        const match =
            value.match(
                /\/([0-9]+)$/,
            );

        if (!match) {
            return null;
        }

        const size =
            Number(
                match[1],
            );

        return (
            Number.isSafeInteger(
                size,
            ) &&
            size >= 0
        )
            ? size
            : null;
    }

    private unavailable(
        providerPublicId: string,
    ): ConflictException {
        return new ConflictException({
            code:
                'MEDIA_FILE_UNAVAILABLE',

            message:
                'Object media pada Vercel Blob tidak tersedia.',

            details: {
                providerPublicId,
            },
        });
    }

    private async readPrefix(
        stream:
            ReadableStream<Uint8Array>,

        maximumBytes:
            number,
    ): Promise<Buffer> {
        const reader =
            stream.getReader();

        const chunks:
            Buffer[] = [];

        let total =
            0;

        try {
            while (
                total <
                maximumBytes
            ) {
                const {
                    done,
                    value,
                } =
                    await reader.read();

                if (
                    done ||
                    !value
                ) {
                    break;
                }

                const remaining =
                    maximumBytes -
                    total;

                const chunk =
                    Buffer.from(
                        value.subarray(
                            0,
                            remaining,
                        ),
                    );

                chunks.push(
                    chunk,
                );

                total +=
                    chunk.length;
            }
        } finally {
            await reader
                .cancel()
                .catch(
                    () =>
                        undefined,
                );

            reader.releaseLock();
        }

        return Buffer.concat(
            chunks,
            total,
        );
    }
}