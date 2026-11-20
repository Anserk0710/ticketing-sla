export type {
    MediaStorageProvider,
} from '../../config/environment';

export type StoredObjectInspection = {
    sizeBytes: number;
    contentType: string | null;
    header: Buffer;
};

export type MediaAccessTarget =
    | {
        kind: 'LOCAL_FILE';
        path: string;
    }
    | {
        kind: 'REDIRECT';
        url: string;
    };

export type DirectUploadRequest = {
    pathname: string;
    contentType: string;
    maximumSizeInBytes: number;
    validUntil: number;
};

export type DirectUploadGrant = {
    provider: 'VERCEL_BLOB';

    uploadMethod:
    'PRESIGNED_PUT';

    uploadUrl: string;

    providerPublicId:
    string;

    expiresAt: Date;
};