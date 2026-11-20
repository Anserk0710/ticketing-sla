import {
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from 'class-validator';

import {
    ALLOWED_UPLOAD_MIME_TYPES,
} from './media.constants';

export class CreateMediaUploadDto {
    /*
     * Optional karena LOCAL mode masih mendukung
     * endpoint signature lama tanpa metadata.
     *
     * VERCEL_BLOB mode akan mewajibkannya di service.
     */
    @IsOptional()
    @IsString()
    @MaxLength(255)
    originalName?: string;

    @IsOptional()
    @IsString()
    @IsIn(
        ALLOWED_UPLOAD_MIME_TYPES,
    )
    contentType?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    sizeBytes?: number;
}

export class FinalizeMediaUploadDto {
    @IsString()
    @MaxLength(950)
    providerPublicId:
        string;

    @IsString()
    @MaxLength(255)
    originalName:
        string;
}