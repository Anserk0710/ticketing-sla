import {
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';

import {
    MediaContext,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { MediaService } from './media.service';

describe(
    'MediaService.validateForContext',
    () => {
        const findMany =
            jest.fn();

        const prisma = {
            mediaAsset: {
                findMany,
            },
        } as unknown as PrismaService;

        const service =
            new MediaService(prisma);

        const technicianId =
            '11111111-1111-4111-8111-111111111111';

        const photoId =
            '22222222-2222-4222-8222-222222222222';

        const photoId2 =
            '33333333-3333-4333-8333-333333333333';

        const videoId =
            '44444444-4444-4444-8444-444444444444';

        beforeEach(() => {
            findMany.mockReset();
        });

        it(
            'rejects public complaint without media',
            async () => {
                await expect(
                    service.validateForContext(
                        [],
                        MediaContext.COMPLAINT,
                    ),
                ).rejects.toBeInstanceOf(
                    BadRequestException,
                );

                expect(
                    findMany,
                ).not.toHaveBeenCalled();
            },
        );

        it(
            'accepts public complaint with multiple supported photos/videos',
            async () => {
                findMany.mockResolvedValue([
                    {
                        id: photoId,
                        resourceType:
                            'image',
                        mimeType:
                            'image/jpeg',
                        uploadedById:
                            null,
                    },
                    {
                        id: videoId,
                        resourceType:
                            'video',
                        mimeType:
                            'video/mp4',
                        uploadedById:
                            null,
                    },
                ]);

                await expect(
                    service.validateForContext(
                        [
                            photoId,
                            videoId,
                        ],
                        MediaContext.COMPLAINT,
                    ),
                ).resolves.toHaveLength(
                    2,
                );
            },
        );

        it(
            'rejects request when one or more media IDs do not exist',
            async () => {
                findMany.mockResolvedValue([
                    {
                        id: photoId,
                        resourceType:
                            'image',
                        mimeType:
                            'image/jpeg',
                        uploadedById:
                            null,
                    },
                ]);

                await expect(
                    service.validateForContext(
                        [
                            photoId,
                            videoId,
                        ],
                        MediaContext.COMPLAINT,
                    ),
                ).rejects.toMatchObject({
                    response:
                        expect.objectContaining({
                            code:
                                'MEDIA_NOT_FOUND',
                        }),
                });
            },
        );

        it(
            'rejects check-in without a photo',
            async () => {
                await expect(
                    service.validateForContext(
                        [],
                        MediaContext.CHECKIN,
                        technicianId,
                    ),
                ).rejects.toMatchObject({
                    response:
                        expect.objectContaining({
                            code:
                                'CHECKIN_MEDIA_COUNT_INVALID',
                        }),
                });
            },
        );

        it(
            'rejects check-in with more than one media',
            async () => {
                await expect(
                    service.validateForContext(
                        [
                            photoId,
                            photoId2,
                        ],
                        MediaContext.CHECKIN,
                        technicianId,
                    ),
                ).rejects.toMatchObject({
                    response:
                        expect.objectContaining({
                            code:
                                'CHECKIN_MEDIA_COUNT_INVALID',
                        }),
                });
            },
        );

        it(
            'rejects check-in with video',
            async () => {
                findMany.mockResolvedValue([
                    {
                        id: videoId,
                        resourceType:
                            'video',
                        mimeType:
                            'video/mp4',
                        uploadedById:
                            technicianId,
                    },
                ]);

                await expect(
                    service.validateForContext(
                        [
                            videoId,
                        ],
                        MediaContext.CHECKIN,
                        technicianId,
                    ),
                ).rejects.toMatchObject({
                    response:
                        expect.objectContaining({
                            code:
                                'MEDIA_TYPE_INVALID_FOR_CONTEXT',
                        }),
                });
            },
        );

        it(
            'rejects check-in/completion media uploaded by another user',
            async () => {
                findMany.mockResolvedValue([
                    {
                        id: photoId,
                        resourceType:
                            'image',
                        mimeType:
                            'image/jpeg',
                        uploadedById:
                            '55555555-5555-4555-8555-555555555555',
                    },
                ]);

                await expect(
                    service.validateForContext(
                        [
                            photoId,
                        ],
                        MediaContext.CHECKIN,
                        technicianId,
                    ),
                ).rejects.toBeInstanceOf(
                    ForbiddenException,
                );
            },
        );

        it(
            'rejects completion without media',
            async () => {
                await expect(
                    service.validateForContext(
                        [],
                        MediaContext.COMPLETION,
                        technicianId,
                    ),
                ).rejects.toMatchObject({
                    response:
                        expect.objectContaining({
                            code:
                                'COMPLETION_MEDIA_REQUIRED',
                        }),
                });
            },
        );

        it(
            'accepts completion with multiple supported photos/videos',
            async () => {
                findMany.mockResolvedValue([
                    {
                        id: photoId,
                        resourceType:
                            'image',
                        mimeType:
                            'image/webp',
                        uploadedById:
                            technicianId,
                    },
                    {
                        id: videoId,
                        resourceType:
                            'video',
                        mimeType:
                            'video/mp4',
                        uploadedById:
                            technicianId,
                    },
                ]);

                await expect(
                    service.validateForContext(
                        [
                            photoId,
                            videoId,
                        ],
                        MediaContext.COMPLETION,
                        technicianId,
                    ),
                ).resolves.toHaveLength(
                    2,
                );
            },
        );

        it(
            'rejects duplicated media IDs',
            async () => {
                await expect(
                    service.validateForContext(
                        [
                            photoId,
                            photoId,
                        ],
                        MediaContext.COMPLETION,
                        technicianId,
                    ),
                ).rejects.toMatchObject({
                    response:
                        expect.objectContaining({
                            code:
                                'MEDIA_IDS_DUPLICATE',
                        }),
                });

                expect(
                    findMany,
                ).not.toHaveBeenCalled();
            },
        );
    },
);