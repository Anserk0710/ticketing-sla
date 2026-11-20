import {
    Module,
} from '@nestjs/common';

import {
    LocalMediaUploadGuard,
} from './local-media-upload.guard';

import {
    MediaController,
} from './media.controller';

import {
    MediaService,
} from './media.service';

import {
    MediaStorageService,
} from './storage/media-storage.service';

import {
    LocalMediaStorageService,
} from './local-media-storage.service';

import {
    VercelBlobMediaStorageService,
} from './storage/vercel-blob-media-storage.service';

@Module({
    controllers: [
        MediaController,
    ],

    providers: [
        MediaService,
        MediaStorageService,
        LocalMediaStorageService,
        VercelBlobMediaStorageService,
        LocalMediaUploadGuard,
    ],

    exports: [
        MediaService,
    ],
})
export class MediaModule { }