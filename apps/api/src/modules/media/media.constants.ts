export const IMAGE_MIME_TYPES:
    readonly string[] = [
        'image/jpeg',
        'image/png',
        'image/webp',
    ];

export const VIDEO_MIME_TYPES:
    readonly string[] = [
        'video/mp4',
        'video/quicktime',
        'video/3gpp',
        'video/3gpp2',
        'video/webm',
        'video/x-msvideo',
        'video/x-matroska',
        'video/x-m4v',
        'video/ogg',
        'video/mpeg',
    ];

export const ALLOWED_UPLOAD_MIME_TYPES:
    readonly string[] = [
        ...IMAGE_MIME_TYPES,
        ...VIDEO_MIME_TYPES,
    ];

export const IMAGE_MAX_SIZE_BYTES =
    10 *
    1024 *
    1024;

export const VIDEO_MAX_SIZE_BYTES =
    100 *
    1024 *
    1024;

export const MEDIA_HEADER_BYTES =
    8192;

export const MEDIA_SIGNED_URL_TTL_MS =
    10 *
    60 *
    1000;

export const MEDIA_ACCESS_URL_TTL_MS =
    5 *
    60 *
    1000;

export function isImageMimeType(
    value: string,
): boolean {
    return IMAGE_MIME_TYPES
        .includes(value);
}

export function isVideoMimeType(
    value: string,
): boolean {
    return VIDEO_MIME_TYPES
        .includes(value);
}

export function maxSizeForMimeType(
    value: string,
): number {
    return isVideoMimeType(value)
        ? VIDEO_MAX_SIZE_BYTES
        : IMAGE_MAX_SIZE_BYTES;
}

export function extensionForMimeType(
    value: string,
): string | null {
    switch (value) {
        case 'image/jpeg':
            return 'jpg';

        case 'image/png':
            return 'png';

        case 'image/webp':
            return 'webp';

        case 'video/mp4':
            return 'mp4';

        case 'video/quicktime':
            return 'mov';

        case 'video/3gpp':
            return '3gp';

        case 'video/3gpp2':
            return '3g2';

        case 'video/webm':
            return 'webm';

        case 'video/x-msvideo':
            return 'avi';

        case 'video/x-matroska':
            return 'mkv';

        case 'video/x-m4v':
            return 'm4v';

        case 'video/ogg':
            return 'ogv';

        case 'video/mpeg':
            return 'mpeg';

        default:
            return null;
    }
}