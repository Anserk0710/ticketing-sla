import { Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags, } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { resolve } from 'path';
import { Response } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { AuthUser } from 'src/common/types/auth-user';
import { MediaService } from './media.service';

const uploadDir = process.env.UPLOAD_DIR ??
  resolve(process.cwd(), 'uploads');

const upload = FileInterceptor('file', {
  storage: diskStorage({
    destination: uploadDir,
    filename: (
      _request,
      _file,
      callback,
    ) => {
      callback(null, randomUUID());
    },
  }),
  limits: {
    fileSize: 100 * 1024 * 1024
  },
});

@ApiTags('Media',)
@Controller()
export class MediaController {
  constructor(private readonly media: MediaService) { }

  @Public()
  @Post('public/media/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(upload)
  uploadPublic(
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    return this.media.registerLocal(file);
  }

  @ApiBearerAuth()
  @Post('media/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(upload)
  uploadInternal(
    @UploadedFile()
    file: Express.Multer.File,
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.media.registerLocal(
      file,
      user.id,
    );
  }

  @ApiBearerAuth()
  @Post(
    'media/signature'
  )
  signature(
    @CurrentUser()
    user: AuthUser,
  ) {
    return {
      provider: 'LOCAL',
      uploadEndpoint: '/api/v1/media/upload',
      actorId: user.id,
      expiresAt: new Date(
        Date.now() + 10 * 60 * 1000
      ),
    };
  }

  @ApiBearerAuth()
  @Get('media/:id/access')
  @Permissions('media.read.internal')
  async access(
    @Param('id')
    id: string,
    @Res()
    response: Response
  ) {
    const result = await this.media.getLocalFile(id);
    response.type(result.media.mimeType);
    return response.sendFile(result.path);
  }
}