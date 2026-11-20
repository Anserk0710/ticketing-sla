import {
    BadRequestException,
    CanActivate,
    ExecutionContext,
    Injectable,
} from '@nestjs/common';

import {
    MediaStorageService,
} from './storage/media-storage.service';

@Injectable()
export class LocalMediaUploadGuard
    implements CanActivate {
    constructor(
        private readonly storage:
            MediaStorageService,
    ) { }

    canActivate(
        _context:
            ExecutionContext,
    ): boolean {
        if (
            this.storage
                .isLocalMode()
        ) {
            return true;
        }

        throw new BadRequestException({
            code:
                'DIRECT_UPLOAD_REQUIRED',

            message:
                'Environment production menggunakan direct upload. Minta signed upload URL terlebih dahulu.',
        });
    }
}