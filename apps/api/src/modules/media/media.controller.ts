import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';

import {
  FileInterceptor,
} from '@nestjs/platform-express';

import {
  randomUUID,
} from 'crypto';

import {
  mkdirSync,
} from 'fs';

import {
  resolve,
} from 'path';

import {
  diskStorage,
} from 'multer';

import {
  Response,
} from 'express';

import {
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

import {
  Permissions,
} from '../../common/decorators/permissions.decorator';

import {
  Public,
} from '../../common/decorators/public.decorator';

import {
  AuthUser,
} from '../../common/types/auth-user';

import {
  LocalMediaUploadGuard,
} from './local-media-upload.guard';

import {
  CreateMediaUploadDto,
  FinalizeMediaUploadDto,
} from './media.dto';

import {
  MediaService,
} from './media.service';

const upload =
  FileInterceptor(
    'file',
    {
      storage:
        diskStorage({
          destination:
            (
              _request,
              _file,
              callback,
            ) => {
              const uploadDir =
                process.env
                  .UPLOAD_DIR ??
                resolve(
                  process.cwd(),
                  'uploads',
                );

              mkdirSync(
                uploadDir,
                {
                  recursive:
                    true,
                },
              );

              callback(
                null,
                uploadDir,
              );
            },

          filename:
            (
              _request,
              _file,
              callback,
            ) => {
              callback(
                null,
                randomUUID(),
              );
            },
        }),

      limits: {
        fileSize:
          100 *
          1024 *
          1024,
      },
    },
  );

@ApiTags('Media')
@Controller()
export class MediaController {
  constructor(
    private readonly media:
      MediaService,
  ) { }

  /*
   * LOCAL development upload.
   */
  @Public()
  @Post('public/media/upload')
  @ApiConsumes('multipart/form-data')
  @UseGuards(
    LocalMediaUploadGuard,
  )
  @UseInterceptors(
    upload,
  )
  uploadPublic(
    @UploadedFile()
    file:
      Express.Multer.File,
  ) {
    return this.media
      .registerLocal(
        file,
      );
  }

  @ApiBearerAuth()
  @Post('media/upload')
  @ApiConsumes('multipart/form-data')
  @UseGuards(
    LocalMediaUploadGuard,
  )
  @UseInterceptors(
    upload,
  )
  uploadInternal(
    @UploadedFile()
    file:
      Express.Multer.File,

    @CurrentUser()
    user:
      AuthUser,
  ) {
    return this.media
      .registerLocal(
        file,
        user.id,
      );
  }

  /*
   * Direct upload handshake.
   *
   * LOCAL:
   * return multipart endpoint.
   *
   * VERCEL_BLOB:
   * return private signed PUT URL.
   */
  @Public()
  @Post('public/media/signature')
  signaturePublic(
    @Body()
    dto:
      CreateMediaUploadDto,
  ) {
    return this.media
      .createUploadGrant(
        dto,
        undefined,
        true,
      );
  }

  @ApiBearerAuth()
  @Post('media/signature')
  signatureInternal(
    @Body()
    dto:
      CreateMediaUploadDto,

    @CurrentUser()
    user:
      AuthUser,
  ) {
    return this.media
      .createUploadGrant(
        dto,
        user.id,
      );
  }

  /*
   * Setelah browser selesai upload langsung ke Blob,
   * Backend memverifikasi object lalu membuat MediaAsset.
   */
  @Public()
  @Post('public/media/finalize')
  finalizePublic(
    @Body()
    dto:
      FinalizeMediaUploadDto,
  ) {
    return this.media
      .finalizeBlobUpload(
        dto,
        undefined,
        true,
      );
  }

  @ApiBearerAuth()
  @Post('media/finalize')
  finalizeInternal(
    @Body()
    dto:
      FinalizeMediaUploadDto,

    @CurrentUser()
    user:
      AuthUser,
  ) {
    return this.media
      .finalizeBlobUpload(
        dto,
        user.id,
      );
  }

  @ApiBearerAuth()
  @Get('media/:id/access')
  @Permissions(
    'media.read.internal',
  )
  async access(
    @Param('id')
    id:
      string,

    @Res()
    response:
      Response,
  ) {
    const result =
      await this.media
        .getAccessTarget(
          id,
        );

    if (
      result.target.kind ===
      'LOCAL_FILE'
    ) {
      response.type(
        result.media.mimeType,
      );

      return response.sendFile(
        result.target.path,
      );
    }

    /*
     * Vercel Blob:
     * redirect ke private GET URL berumur pendek.
     */
    return response.redirect(
      302,
      result.target.url,
    );
  }
}