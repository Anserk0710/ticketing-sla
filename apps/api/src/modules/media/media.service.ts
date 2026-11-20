import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  MediaAccess,
  MediaContext,
  Prisma,
} from '@prisma/client';

import {
  randomUUID,
} from 'crypto';

import {
  PrismaService,
} from '../../database/prisma.service';

import {
  ALLOWED_UPLOAD_MIME_TYPES,
  IMAGE_MAX_SIZE_BYTES,
  IMAGE_MIME_TYPES,
  MEDIA_SIGNED_URL_TTL_MS,
  VIDEO_MAX_SIZE_BYTES,
  VIDEO_MIME_TYPES,
  extensionForMimeType,
  maxSizeForMimeType,
} from './media.constants';

import {
  CreateMediaUploadDto,
  FinalizeMediaUploadDto,
} from './media.dto';

import {
  MediaStorageService,
} from './storage/media-storage.service';

type MediaResourceType =
  | 'IMAGE'
  | 'VIDEO';

type DetectedMedia = {
  resourceType:
  MediaResourceType;

  mimeType:
  string;

  extension:
  string;
};

type StoredMediaIntegrityAsset = {
  provider:
  string;

  providerPublicId:
  string;

  resourceType:
  string;

  mimeType:
  string;

  sizeBytes:
  number;
};

type ValidatedMediaAsset =
  StoredMediaIntegrityAsset & {
    id:
    string;

    uploadedById:
    string | null;
  };

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly storage:
      MediaStorageService,
  ) { }

  async registerLocal(
    file:
      Express.Multer.File,

    uploadedById?:
      string,
  ) {
    if (!file) {
      throw new BadRequestException({
        code:
          'FILE_REQUIRED',

        message:
          'File wajib diunggah.',
      });
    }

    try {
      const inspected =
        await this.storage
          .inspectLocalUpload(
            file.path,
          );

      /*
       * Tetap tidak percaya file.mimetype.
       *
       * Format ditentukan berdasarkan actual bytes.
       */
      const detected =
        this.detectMediaFromHeader(
          inspected.header,
        );

      if (!detected) {
        throw new BadRequestException({
          code:
            'MEDIA_SIGNATURE_INVALID',

          message:
            'Isi file bukan format foto/video yang didukung.',
        });
      }

      this.assertDetectedSize(
        detected,
        inspected.sizeBytes,
      );

      return await this.prisma
        .mediaAsset
        .create({
          data: {
            provider:
              'LOCAL',

            providerPublicId:
              file.filename,

            originalName:
              file.originalname,

            resourceType:
              detected.resourceType,

            mimeType:
              detected.mimeType,

            extension:
              detected.extension,

            sizeBytes:
              inspected.sizeBytes,

            access:
              MediaAccess.INTERNAL,

            uploadedById,
          },
        });
    } catch (error) {
      await this.storage
        .deleteLocalUpload(
          file.path,
        );

      throw error;
    }
  }

  async createUploadGrant(
    dto:
      CreateMediaUploadDto,

    uploadedById?:
      string,

    isPublic =
      false,
  ) {
    /*
     * Development tetap compatible dengan frontend lama.
     */
    if (
      this.storage
        .isLocalMode()
    ) {
      return {
        provider:
          'LOCAL' as const,

        uploadMethod:
          'MULTIPART' as const,

        uploadEndpoint:
          isPublic
            ? '/api/v1/public/media/upload'
            : '/api/v1/media/upload',

        actorId:
          uploadedById ??
          null,

        expiresAt:
          new Date(
            Date.now() +
            MEDIA_SIGNED_URL_TTL_MS,
          ),
      };
    }

    /*
     * Direct upload membutuhkan metadata awal
     * untuk membatasi signed URL.
     *
     * Metadata ini belum dianggap trusted.
     * Actual file tetap divalidasi pada finalize.
     */
    const originalName =
      dto.originalName
        ?.trim();

    const contentType =
      dto.contentType
        ?.trim()
        .toLowerCase();

    const sizeBytes =
      dto.sizeBytes;

    if (
      !originalName ||
      !contentType ||
      !sizeBytes
    ) {
      throw new BadRequestException({
        code:
          'MEDIA_UPLOAD_METADATA_REQUIRED',

        message:
          'originalName, contentType, dan sizeBytes wajib dikirim untuk direct upload.',
      });
    }

    if (
      !ALLOWED_UPLOAD_MIME_TYPES
        .includes(
          contentType,
        )
    ) {
      throw new BadRequestException({
        code:
          'MEDIA_CONTENT_TYPE_UNSUPPORTED',

        message:
          'Format foto/video tidak didukung.',

        details: {
          contentType,
        },
      });
    }

    const maximumSizeInBytes =
      maxSizeForMimeType(
        contentType,
      );

    if (
      sizeBytes >
      maximumSizeInBytes
    ) {
      throw new BadRequestException({
        code:
          'MEDIA_TOO_LARGE',

        message:
          maximumSizeInBytes ===
            VIDEO_MAX_SIZE_BYTES
            ? 'Ukuran video maksimal 100 MB.'
            : 'Ukuran gambar maksimal 10 MB.',
      });
    }

    const extension =
      extensionForMimeType(
        contentType,
      );

    if (!extension) {
      throw new BadRequestException({
        code:
          'MEDIA_CONTENT_TYPE_UNSUPPORTED',

        message:
          'Format foto/video tidak didukung.',

        details: {
          contentType,
        },
      });
    }

    /*
     * Object authenticated dipisah per user.
     *
     * Public complaint memiliki scope sendiri.
     */
    const scope =
      isPublic
        ? 'public'
        : `users/${uploadedById}`;

    const pathname =
      `media/${scope}/${randomUUID()}.${extension}`;

    const validUntil =
      Date.now() +
      MEDIA_SIGNED_URL_TTL_MS;

    const grant =
      await this.storage
        .createDirectUpload({
          pathname,
          contentType,
          maximumSizeInBytes,
          validUntil,
        });

    return {
      ...grant,

      actorId:
        uploadedById ??
        null,

      finalizeEndpoint:
        isPublic
          ? '/api/v1/public/media/finalize'
          : '/api/v1/media/finalize',
    };
  }

  async finalizeBlobUpload(
    dto:
      FinalizeMediaUploadDto,

    uploadedById?:
      string,

    isPublic =
      false,
  ) {
    if (
      this.storage
        .currentProvider() !==
      'VERCEL_BLOB'
    ) {
      throw new BadRequestException({
        code:
          'BLOB_FINALIZE_NOT_AVAILABLE',

        message:
          'Finalize Vercel Blob hanya tersedia pada storage production.',
      });
    }

    const expectedPrefix =
      isPublic
        ? 'media/public/'
        : `media/users/${uploadedById}/`;

    /*
     * User tidak boleh finalize object milik scope user lain.
     */
    if (
      !dto.providerPublicId
        .startsWith(
          expectedPrefix,
        )
    ) {
      throw new ForbiddenException({
        code:
          'MEDIA_UPLOAD_SCOPE_INVALID',

        message:
          'Media tidak berada pada upload scope milik pengguna ini.',
      });
    }

    /*
     * Finalize idempotent.
     */
    const existing =
      await this.prisma
        .mediaAsset
        .findUnique({
          where: {
            providerPublicId:
              dto.providerPublicId,
          },
        });

    if (existing) {
      const expectedUploaderId =
        uploadedById ??
        null;

      if (
        existing.uploadedById !==
        expectedUploaderId
      ) {
        throw new ForbiddenException({
          code:
            'MEDIA_OWNERSHIP_INVALID',

          message:
            'Media sudah terdaftar oleh uploader lain.',
        });
      }

      return existing;
    }

    try {
      /*
       * Baca hanya header + metadata Blob.
       */
      const inspected =
        await this.storage
          .inspectStored(
            'VERCEL_BLOB',
            dto.providerPublicId,
          );

      /*
       * Actual magic bytes tetap menjadi sumber kebenaran.
       */
      const detected =
        this.detectMediaFromHeader(
          inspected.header,
        );

      if (!detected) {
        throw new BadRequestException({
          code:
            'MEDIA_SIGNATURE_INVALID',

          message:
            'Isi file bukan format foto/video yang didukung.',
        });
      }

      this.assertDetectedSize(
        detected,
        inspected.sizeBytes,
      );

      /*
       * Content-Type Vercel Blob juga harus cocok
       * dengan magic-byte detection.
       */
      if (
        inspected.contentType &&
        inspected.contentType
          .toLowerCase() !==
        detected.mimeType
      ) {
        throw new BadRequestException({
          code:
            'MEDIA_CONTENT_TYPE_MISMATCH',

          message:
            'Content-Type object tidak sesuai dengan isi file.',

          details: {
            storedContentType:
              inspected.contentType,

            detectedContentType:
              detected.mimeType,
          },
        });
      }

      /*
       * Upsert membuat finalization aman bila dua request
       * dikirim bersamaan.
       */
      return await this.prisma
        .mediaAsset
        .upsert({
          where: {
            providerPublicId:
              dto.providerPublicId,
          },

          update: {},

          create: {
            provider:
              'VERCEL_BLOB',

            providerPublicId:
              dto.providerPublicId,

            originalName:
              dto.originalName,

            resourceType:
              detected.resourceType,

            mimeType:
              detected.mimeType,

            extension:
              detected.extension,

            sizeBytes:
              inspected.sizeBytes,

            access:
              MediaAccess.INTERNAL,

            uploadedById,
          },
        });
    } catch (error) {
      /*
       * Object invalid/orphan langsung dibuang.
       */
      await this.storage
        .deleteStored(
          'VERCEL_BLOB',
          dto.providerPublicId,
        );

      throw error;
    }
  }

  async validateForContext(
    mediaIds: string[] | undefined,
    context: MediaContext,
    uploadedById?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ValidatedMediaAsset[]> {
    const ids = mediaIds ?? [];

    this.assertMediaCount(ids, context);

    const uniqueIds = [...new Set(ids)];

    if (uniqueIds.length !== ids.length) {
      throw new BadRequestException({
        code: 'MEDIA_IDS_DUPLICATE',
        message: 'Media yang sama tidak boleh dikirim lebih dari satu kali.',
      });
    }

    const query = {
      where: {
        id: {
          in:
            uniqueIds,
        },
      },

      select: {
        id:
          true,

        provider:
          true,

        providerPublicId:
          true,

        resourceType:
          true,

        mimeType:
          true,

        sizeBytes:
          true,

        uploadedById:
          true,
      },
    } satisfies Prisma.MediaAssetFindManyArgs;

    const assets = tx
      ? await tx.mediaAsset.findMany(query)
      : await this.prisma.mediaAsset.findMany(query);
    /*
     * Penting:
     * Jangan hanya mengecek assets.length > 0.
     *
     * Jika frontend mengirim:
     * [valid-id, fake-id]
     *
     * findMany() hanya akan mengembalikan valid-id.
     * Karena itu jumlah result harus sama dengan jumlah ID request.
     */
    if (assets.length !== uniqueIds.length) {
      const foundIds = new Set(
        assets.map((asset) => asset.id),
      );

      const missingIds = uniqueIds.filter(
        (id) => !foundIds.has(id),
      );

      throw new BadRequestException({
        code: 'MEDIA_NOT_FOUND',
        message: 'Satu atau lebih media tidak ditemukan.',
        details: {
          missingIds,
        },
      });
    }
    /*
     * Untuk action authenticated seperti CHECKIN dan COMPLETION,
     * media harus benar-benar di-upload oleh teknisi yang
     * sedang menjalankan action tersebut.
     *
     * Public complaint tidak memiliki authenticated uploader,
     * sehingga uploadedById tidak dikirim saat context COMPLAINT.
     */
    if (uploadedById) {
      const foreignAssets = assets.filter(
        (asset) => asset.uploadedById !== uploadedById
      );

      if (foreignAssets.length) {
        throw new ForbiddenException({
          code: 'MEDIA_OWNERSHIP_INVALID',
          message: 'Media check-in/completion harus diunggah oleh teknisi yang melakukan aksi.',
          details: {
            mediaIds: foreignAssets.map(
              (asset) => asset.id,
            ),
          },
        });
      }
    }
    /*
     * Verifikasi bukan hanya mimeType.
     *
     * resourceType dan mimeType harus konsisten.
     *
     * Contoh invalid:
     * resourceType = image
     * mimeType      = video/mp4
     */
    const invalidAssets = assets.filter(
      (asset) =>
        !this.isAllowedForContext(asset, context),
    );

    if (invalidAssets.length) {
      const message =
        context === MediaContext.CHECKIN
          ? 'Check-in hanya menerima tepat 1 foto berformat JPEG, PNG, atau WEBP.'
          : 'Media harus berupa foto JPEG/PNG/WEBP atau video MP4.';

      throw new BadRequestException({
        code: 'MEDIA_TYPE_INVALID_FOR_CONTEXT',
        message,
        details: {
          context,
          media: invalidAssets.map((asset) => ({
            id: asset.id,
            resourceType: asset.resourceType,
            mimeType: asset.mimeType,
          })),
        },
      });
    }

    for (
      const asset of assets
    ) {
      await this.assertStoredAssetIntegrity(
        asset,
      );
    }

    return assets;
  }

  async assertCompletionEvidenceForMembers(
    assignmentMemberIds: string[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const uniqueMemberIds = [
      ...new Set(
        assignmentMemberIds,
      ),
    ];

    if (
      uniqueMemberIds.length ===
      0
    ) {
      return;
    }

    const completions =
      await tx.workCompletion.findMany({
        where: {
          assignmentMemberId: {
            in:
              uniqueMemberIds,
          },
        },

        select: {
          assignmentMemberId:
            true,

          mediaLinks: {
            where: {
              context:
                MediaContext.COMPLETION,
            },

            select: {
              mediaAsset: {
                select: {
                  provider:
                    true,

                  providerPublicId:
                    true,

                  resourceType:
                    true,

                  mimeType:
                    true,

                  sizeBytes:
                    true,
                },
              },
            },
          },
        },
      });

    const membersWithValidEvidence =
      new Set<string>();

    for (
      const completion of
      completions
    ) {
      let hasValidEvidence =
        false;

      for (
        const link of
        completion.mediaLinks
      ) {
        const asset =
          link.mediaAsset;

        /*
         * Pertama cek business MIME/context.
         */
        if (
          !this.isAllowedForContext(
            asset,
            MediaContext.COMPLETION,
          )
        ) {
          continue;
        }

        try {
          /*
           * Kemudian buktikan object fisik benar-benar ada.
           *
           * Legacy EXTERNAL/fake MediaAsset akan gagal di sini.
           */
          await this.assertStoredAssetIntegrity(
            asset,
          );

          hasValidEvidence =
            true;

          break;
        } catch {
          /*
           * Jika satu evidence rusak tetapi member mempunyai
           * evidence valid lain, resolve masih boleh berjalan.
           */
        }
      }

      if (
        hasValidEvidence
      ) {
        membersWithValidEvidence.add(
          completion.assignmentMemberId,
        );
      }
    }

    const missingMemberIds =
      uniqueMemberIds.filter(
        (memberId) =>
          !membersWithValidEvidence.has(
            memberId,
          ),
      );

    if (
      missingMemberIds.length >
      0
    ) {
      throw new ConflictException({
        code:
          'COMPLETION_EVIDENCE_REQUIRED',

        message:
          'Seluruh teknisi wajib harus memiliki completion dengan minimal 1 foto atau video fisik yang valid sebelum ticket dapat di-resolve.',

        details: {
          memberIds:
            missingMemberIds,
        },
      });
    }
  }

  async get(id: string) {
    const media =
      await this.prisma.mediaAsset.findUnique({
        where: {
          id,
        },
      });

    if (!media) {
      throw new NotFoundException({
        code: 'MEDIA_NOT_FOUND',
        message: 'Media tidak ditemukan.',
      });
    }

    return media;
  }

  async getAccessTarget(
    id:
      string,
  ) {
    const media =
      await this.get(
        id,
      );

    await this.assertStoredAssetIntegrity({
      provider:
        media.provider,

      providerPublicId:
        media.providerPublicId,

      resourceType:
        media.resourceType,

      mimeType:
        media.mimeType,

      sizeBytes:
        media.sizeBytes,
    });

    return {
      media,

      target:
        await this.storage
          .access(
            media.provider,
            media.providerPublicId,
          ),
    };
  }

  private async assertStoredAssetIntegrity(
    asset:
      StoredMediaIntegrityAsset,
  ): Promise<void> {
    const inspected =
      await this.storage
        .inspectStored(
          asset.provider,
          asset.providerPublicId,
        );

    /*
     * Database size harus sama dengan file/object sebenarnya.
     */
    if (
      inspected.sizeBytes !==
      asset.sizeBytes
    ) {
      throw new ConflictException({
        code:
          'MEDIA_FILE_SIZE_MISMATCH',

        message:
          'Ukuran file tidak cocok dengan yang diharapkan.',

        details: {
          expectedSize:
            asset.sizeBytes,

          actualSize:
            inspected.sizeBytes,
        },
      });
    }

    /*
     * Magic byte tetap divalidasi baik untuk
     * LOCAL maupun VERCEL_BLOB.
     */
    const detected =
      this.detectMediaFromHeader(
        inspected.header,
      );

    if (!detected) {
      throw new ConflictException({
        code:
          'MEDIA_FILE_SIGNATURE_INVALID',

        message:
          'Isi file media tidak sesuai dengan format.',
      });
    }

    const storedResourceType =
      asset.resourceType
        .toUpperCase();

    if (
      detected.resourceType !==
      storedResourceType ||
      detected.mimeType !==
      asset.mimeType
    ) {
      throw new ConflictException({
        code:
          'MEDIA_FILE_METADATA_MISMATCH',

        message:
          'Isi file media tidak sesuai dengan metadata yang tersimpan.',

        details: {
          stored: {
            resourceType:
              asset.resourceType,

            mimeType:
              asset.mimeType,
          },

          detected: {
            resourceType:
              detected.resourceType,

            mimeType:
              detected.mimeType,
          },
        },
      });
    }

    /*
     * LOCAL tidak memiliki object Content-Type,
     * sehingga nilainya null dan block ini dilewati.
     */
    if (
      inspected.contentType &&
      inspected.contentType
        .toLowerCase() !==
      asset.mimeType
    ) {
      throw new ConflictException({
        code:
          'MEDIA_FILE_CONTENT_TYPE_MISMATCH',

        message:
          'Content-Type object media tidak sesuai dengan metadata.',

        details: {
          storedMimeType:
            asset.mimeType,

          objectContentType:
            inspected.contentType,
        },
      });
    }
  }

  private assertDetectedSize(
    detected:
      DetectedMedia,

    sizeBytes:
      number,
  ): void {
    const maximumSize =
      detected.resourceType ===
        'VIDEO'
        ? VIDEO_MAX_SIZE_BYTES
        : IMAGE_MAX_SIZE_BYTES;

    if (
      sizeBytes >
      maximumSize
    ) {
      throw new BadRequestException({
        code:
          'MEDIA_TOO_LARGE',

        message:
          detected.resourceType ===
            'VIDEO'
            ? 'Ukuran video maksimal 100 MB.'
            : 'Ukuran gambar maksimal 10 MB.',
      });
    }
  }

  private detectMediaFromHeader(
    header: Buffer,
  ): DetectedMedia | null {
    if (
      header.length >= 3 &&
      header[0] === 0xff &&
      header[1] === 0xd8 &&
      header[2] === 0xff
    ) {
      return {
        resourceType: 'IMAGE',
        mimeType: 'image/jpeg',
        extension: 'jpg',
      };
    }

    const pngSignature =
      Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
      ]);

    if (
      header.length >= pngSignature.length &&
      header.subarray(
        0,
        pngSignature.length,
      )
        .equals(
          pngSignature,
        )
    ) {
      return {
        resourceType: 'IMAGE',
        mimeType: 'image/png',
        extension: 'png',
      };
    }

    if (
      header.length >=
      12 &&
      header.toString(
        'ascii',
        0,
        4,
      ) ===
      'RIFF' &&
      header.toString(
        'ascii',
        8,
        12,
      ) ===
      'WEBP'
    ) {
      return {
        resourceType:
          'IMAGE',

        mimeType:
          'image/webp',

        extension:
          'webp',
      };
    }

    /*
     * AVI
     *
     * RIFF .... AVI
     */
    if (
      header.length >=
      12 &&
      header.toString(
        'ascii',
        0,
        4,
      ) ===
      'RIFF' &&
      header.toString(
        'ascii',
        8,
        11,
      ) ===
      'AVI'
    ) {
      return {
        resourceType:
          'VIDEO',

        mimeType:
          'video/x-msvideo',

        extension:
          'avi',
      };
    }

    /*
     * WebM / Matroska
     *
     * EBML signature:
     * 1A 45 DF A3
     */
    if (
      header.length >=
      4 &&
      header[0] ===
      0x1a &&
      header[1] ===
      0x45 &&
      header[2] ===
      0xdf &&
      header[3] ===
      0xa3
    ) {
      const content =
        header
          .toString(
            'latin1',
          )
          .toLowerCase();

      if (
        content.includes(
          'webm',
        )
      ) {
        return {
          resourceType:
            'VIDEO',

          mimeType:
            'video/webm',

          extension:
            'webm',
        };
      }

      if (
        content.includes(
          'matroska',
        )
      ) {
        return {
          resourceType:
            'VIDEO',

          mimeType:
            'video/x-matroska',

          extension:
            'mkv',
        };
      }

      return null;
    }

    /*
     * OGG video.
     *
     * Ogg container sendiri juga dapat berisi audio.
     * Karena context kita membutuhkan video,
     * kita hanya menerima signature Theora.
     */
    if (
      header.length >=
      4 &&
      header.toString(
        'ascii',
        0,
        4,
      ) ===
      'OggS'
    ) {
      const content =
        header
          .toString(
            'latin1',
          )
          .toLowerCase();

      if (
        content.includes(
          'theora',
        )
      ) {
        return {
          resourceType:
            'VIDEO',

          mimeType:
            'video/ogg',

          extension:
            'ogv',
        };
      }

      return null;
    }

    /*
     * MPEG Program Stream / MPEG Video.
     */
    if (
      header.length >=
      4 &&
      header[0] ===
      0x00 &&
      header[1] ===
      0x00 &&
      header[2] ===
      0x01 &&
      (
        header[3] ===
        0xba ||
        header[3] ===
        0xb3
      )
    ) {
      return {
        resourceType:
          'VIDEO',

        mimeType:
          'video/mpeg',

        extension:
          'mpeg',
      };
    }

    /*
     * MP4 / MOV / M4V / 3GP / 3G2
     * memakai ISO Base Media File Format.
     */
    const isoMedia =
      this.detectIsoBaseMedia(
        header,
      );

    if (
      isoMedia
    ) {
      return isoMedia;
    }

    return null
  }

  private detectIsoBaseMedia(
    header: Buffer,
  ): DetectedMedia | null {
    let offset =
      0;

    /*
     * Cari box `ftyp`.
     *
     * Biasanya ftyp adalah box pertama, tetapi parser
     * ini tetap dapat melewati box kecil sebelumnya.
     */
    while (
      offset +
      8 <=
      header.length
    ) {
      let boxSize =
        header.readUInt32BE(
          offset,
        );

      const boxType =
        header.toString(
          'ascii',
          offset + 4,
          offset + 8,
        );

      let headerSize =
        8;

      /*
       * Extended 64-bit size.
       */
      if (
        boxSize ===
        1
      ) {
        if (
          offset +
          16 >
          header.length
        ) {
          return null;
        }

        const extendedSize =
          header.readBigUInt64BE(
            offset + 8,
          );

        if (
          extendedSize >
          BigInt(
            Number.MAX_SAFE_INTEGER,
          )
        ) {
          return null;
        }

        boxSize =
          Number(
            extendedSize,
          );

        headerSize =
          16;
      }

      /*
       * size 0 berarti box berjalan sampai EOF.
       * Tidak berguna untuk mencari ftyp berikutnya.
       */
      if (
        boxSize ===
        0
      ) {
        break;
      }

      if (
        boxSize <
        headerSize
      ) {
        return null;
      }

      if (
        boxType ===
        'ftyp'
      ) {
        const dataStart =
          offset +
          headerSize;

        if (
          dataStart +
          8 >
          header.length
        ) {
          return null;
        }

        const boxEnd =
          Math.min(
            offset +
            boxSize,
            header.length,
          );

        const brands:
          string[] = [];

        /*
         * major_brand
         */
        brands.push(
          header.toString(
            'ascii',
            dataStart,
            dataStart + 4,
          ),
        );

        /*
         * compatible_brands dimulai setelah:
         *
         * major_brand   4 byte
         * minor_version 4 byte
         */
        for (
          let position =
            dataStart +
            8;

          position +
          4 <=
          boxEnd;

          position +=
          4
        ) {
          brands.push(
            header.toString(
              'ascii',
              position,
              position + 4,
            ),
          );
        }

        const normalizedBrands =
          brands.map(
            (brand) =>
              brand
                .trim()
                .toLowerCase(),
          );

        /*
         * HEIC / HEIF / AVIF menggunakan container BMFF juga,
         * tetapi bukan video yang kita dukung.
         */
        const imageBrands =
          new Set([
            'heic',
            'heix',
            'hevc',
            'hevx',
            'mif1',
            'msf1',
            'avif',
            'avis',
          ]);

        if (
          normalizedBrands.some(
            (brand) =>
              imageBrands.has(
                brand,
              ),
          )
        ) {
          return null;
        }

        /*
         * Apple QuickTime.
         */
        if (
          normalizedBrands.includes(
            'qt',
          )
        ) {
          return {
            resourceType:
              'VIDEO',

            mimeType:
              'video/quicktime',

            extension:
              'mov',
          };
        }

        /*
         * 3GPP2.
         */
        if (
          normalizedBrands.some(
            (brand) =>
              brand.startsWith(
                '3g2',
              ),
          )
        ) {
          return {
            resourceType:
              'VIDEO',

            mimeType:
              'video/3gpp2',

            extension:
              '3g2',
          };
        }

        /*
         * 3GPP.
         */
        if (
          normalizedBrands.some(
            (brand) =>
              brand.startsWith(
                '3gp',
              ) ||
              brand.startsWith(
                '3ge',
              ) ||
              brand.startsWith(
                '3gg',
              ),
          )
        ) {
          return {
            resourceType:
              'VIDEO',

            mimeType:
              'video/3gpp',

            extension:
              '3gp',
          };
        }

        /*
         * Apple M4V.
         */
        if (
          normalizedBrands.some(
            (brand) =>
              brand.startsWith(
                'm4v',
              ),
          )
        ) {
          return {
            resourceType:
              'VIDEO',

            mimeType:
              'video/x-m4v',

            extension:
              'm4v',
          };
        }

        /*
         * ISO BMFF video generik.
         *
         * MIME client tidak dipakai.
         */
        const mp4Brands =
          new Set([
            'isom',
            'iso2',
            'iso3',
            'iso4',
            'iso5',
            'iso6',
            'mp41',
            'mp42',
            'avc1',
            'dash',
            'mp71',
            'msnv',
          ]);

        if (
          normalizedBrands.some(
            (brand) =>
              mp4Brands.has(
                brand,
              ),
          )
        ) {
          return {
            resourceType:
              'VIDEO',

            mimeType:
              'video/mp4',

            extension:
              'mp4',
          };
        }

        return null;
      }

      /*
       * Jangan mencoba membaca box yang ukurannya
       * lebih besar daripada buffer header.
       *
       * ftyp secara normal berada sangat awal.
       */
      if (
        boxSize >
        header.length -
        offset
      ) {
        break;
      }

      offset +=
        boxSize;
    }

    return null;
  }

  private assertMediaCount(
    mediaIds: string[],
    context: MediaContext,
  ) {
    if (
      context === MediaContext.COMPLAINT &&
      mediaIds.length < 1
    ) {
      throw new BadRequestException({
        code: 'COMPLAINT_MEDIA_REQUIRED',
        message: 'Public complaint wajib memiliki minimal 1 foto atau video.',
      });
    }

    if (
      context === MediaContext.CHECKIN &&
      mediaIds.length !== 1
    ) {
      throw new BadRequestException({
        code: 'CHECKIN_MEDIA_COUNT_INVALID',
        message: 'Check-in wajib memiliki tepat 1 foto.',
      });
    }

    if (
      context === MediaContext.COMPLETION &&
      mediaIds.length < 1
    ) {
      throw new BadRequestException({
        code: 'COMPLETION_MEDIA_REQUIRED',
        message: 'Completion wajib memiliki minimal 1 foto atau video.',
      });
    }
  }

  private isAllowedForContext(
    asset: Pick<ValidatedMediaAsset, 'resourceType' | 'mimeType'>,
    context: MediaContext,
  ): boolean {
    const isImage = asset.resourceType.toUpperCase() === 'IMAGE' &&
      IMAGE_MIME_TYPES.includes(asset.mimeType);

    const isVideo = asset.resourceType.toUpperCase() === 'VIDEO' &&
      VIDEO_MIME_TYPES.includes(asset.mimeType);

    /*
     * CHECKIN hanya boleh image.
     */
    if (context === MediaContext.CHECKIN) {
      return isImage;
    }

    /*
     * COMPLAINT dan COMPLETION
     * boleh image atau video.
     */
    return isImage || isVideo;
  }
}
