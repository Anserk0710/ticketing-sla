import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MediaAccess, MediaContext, Prisma } from '@prisma/client';
import { open, stat, unlink } from 'fs/promises';
import { basename, resolve } from 'path';
import { PrismaService } from '../../database/prisma.service';

const IMAGE_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const VIDEO_MIME_TYPES: readonly string[] = [
  'video/mp4',           // Android, Windows, iPhone (H.264/H.265)
  'video/quicktime',     // iPhone/iPad default (.mov)
  'video/3gpp',          // Samsung & Android lama (.3gp)
  'video/3gpp2',         // Android (.3g2)
  'video/webm',          // Browser/Android Chrome (.webm)
  'video/x-msvideo',     // Windows (.avi)
  'video/x-matroska',    // MKV (.mkv)
  'video/x-m4v',         // Apple M4V (.m4v)
  'video/ogg',           // OGG video (.ogv)
  'video/mpeg',          // MPEG (.mpeg, .mpg)
];

const ALLOWED_UPLOAD_MIME_TYPES: readonly string[] = [
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
];

type MediaResourceType =
  | 'IMAGE' | 'VIDEO';

type DetectedMedia = {
  resourceType: MediaResourceType;
  mimeType: string;
  extension: string;
};

type StoredMediaIntegrityAsset = {
  provider: string;
  providerPublicId: string;
  resourceType: string;
  mimeType: string;
  sizeBytes: number;
};

type ValidatedMediaAsset =
  StoredMediaIntegrityAsset & {
    id: string;
    uploadedById: string | null;
  }

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) { }

  async registerLocal(
    file: Express.Multer.File,
    uploadedById?: string,
  ) {
    if (
      !file
    ) {
      throw new BadRequestException({
        code:
          'FILE_REQUIRED',

        message:
          'File wajib diunggah.',
      });
    }

    try {
      /*
       * Jangan percaya:
       *
       * file.mimetype
       * file.originalname extension
       *
       * Keduanya berasal dari client multipart.
       *
       * Tipe media harus ditentukan dari byte file
       * yang benar-benar sudah tersimpan.
       */
      const detected =
        await this.detectLocalMedia(
          file.path,
        );

      if (
        !detected
      ) {
        throw new BadRequestException({
          code:
            'MEDIA_SIGNATURE_INVALID',

          message:
            'Isi file bukan format foto/video yang didukung.',
        });
      }

      /*
       * Ukuran berasal dari file fisik di storage,
       * bukan metadata client.
       */
      const fileStat =
        await stat(
          file.path,
        );

      if (
        !fileStat.isFile()
      ) {
        throw new BadRequestException({
          code:
            'MEDIA_FILE_INVALID',

          message:
            'Upload tidak menghasilkan file yang valid.',
        });
      }

      const maxSize =
        detected.resourceType ===
          'VIDEO'
          ? 100 *
          1024 *
          1024
          : 10 *
          1024 *
          1024;

      if (
        fileStat.size >
        maxSize
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

      /*
       * Metadata yang disimpan berasal dari hasil
       * deteksi backend.
       *
       * file.mimetype dari client TIDAK digunakan.
       */
      return await this.prisma.mediaAsset.create({
        data: {
          provider:
            'LOCAL',

          /*
           * filename dibuat oleh server menggunakan UUID.
           * Client tidak pernah menentukan providerPublicId.
           */
          providerPublicId:
            file.filename,

          /*
           * originalName boleh disimpan untuk display/audit,
           * tetapi tidak pernah dipercaya sebagai file type.
           */
          originalName:
            file.originalname,

          resourceType:
            detected.resourceType,

          mimeType:
            detected.mimeType,

          extension:
            detected.extension,

          sizeBytes:
            fileStat.size,

          access:
            MediaAccess.INTERNAL,

          uploadedById,
        },
      });
    } catch (
    error
    ) {
      /*
       * Multer diskStorage menulis file SEBELUM
       * registerLocal() melakukan validation.
       *
       * Jadi file invalid harus langsung dibuang.
       *
       * Ini juga mencegah orphan file ketika insert DB gagal.
       */
      await this.safeDelete(
        file.path,
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

  async getLocalFile(
    id: string,
  ) {
    const media = await this.get(
      id,
    );

    await this.assertStoredAssetIntegrity({
      provider: media.provider,
      providerPublicId: media.providerPublicId,
      resourceType: media.resourceType,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
    });

    return {
      media,
      path: this.localPath(media.providerPublicId),
    };
  }

  private localPath(
    providerPublicId: string,
  ): string {
    if (
      basename(
        providerPublicId,
      ) !==
      providerPublicId
    ) {
      throw new ConflictException({
        code: 'MEDIA_STORAGE_PATH_INVALID',
        message: 'Path media local tidak valid.',
      });
    }

    const uploadRoot =
      resolve(
        process.env.UPLOAD_DIR ??
        resolve(
          process.cwd(),
          'uploads',
        ),
      );

    return resolve(
      uploadRoot,
      providerPublicId,
    );
  }

  private async assertStoredAssetIntegrity(
    asset: StoredMediaIntegrityAsset,
  ): Promise<void> {
    if (asset.provider !== 'LOCAL') {
      throw new BadRequestException({
        code: 'MEDIA_PROVIDER_UNSUPPORTED',
        message: 'Media provider belum didukung sebagai evidence.',
        details: {
          provider: asset.provider,
        },
      });
    }

    const filePath = this.localPath(asset.providerPublicId);
    let fileStat;
    try {
      fileStat = await stat(filePath);
    } catch {
      /*
       * Path tidak ada adalah kondisi ERROR.
       *
       * Jangan biarkan client tetap bisa upload media,
       * karena itu membuat business-rule lenyap.
       */
      throw new ConflictException({
        code: 'MEDIA_FILE_UNAVAILABLE',
        message: 'File media tidak tersedia atau telah dihapus.',
        details: {
          providerPublicId:
            asset.providerPublicId,
        },
      });
    }

    if (
      !fileStat.isFile()
    ) {
      throw new ConflictException({
        code: 'MEDIA_FILE_UNAVAILABLE',
        message: 'File media tidak tersedia atau telah dihapus.',
        details: {
          providerPublicId:
            asset.providerPublicId,
        },
      });
    }

    if (
      fileStat.size !==
      asset.sizeBytes
    ) {
      throw new ConflictException({
        code: 'MEDIA_FILE_SIZE_MISMATCH',
        message: 'Ukuran file tidak cocok dengan yang diharapkan.',
        details: {
          expectedSize: asset.sizeBytes,
          actualSize: fileStat.size,
        },
      });
    }

    const detected = await this.detectLocalMedia(
      filePath,
    );
    if (!detected) {
      throw new ConflictException({
        code: 'MEDIA_FILE_SIGNATURE_INVALID',
        message: 'Isi file media tidak sesuai dengan format'
      });
    }

    const storedResourceType = asset.resourceType.toUpperCase();

    if (detected.resourceType !== storedResourceType || detected.mimeType !== asset.mimeType) {
      throw new ConflictException({
        code: 'MEDIA_FILE_METADATA_MISMATCH',
        message: 'Isi file media tidak sesua dengan metadata yang tersimpan.',
        details: {
          stored: {
            resourceType: asset.resourceType,
            mimeType: asset.mimeType,
          },
          detected: {
            resourceType: detected.resourceType,
            mimeType: detected.mimeType,
          },
        },
      });
    }
  }

  private async detectLocalMedia(
    filePath: string,
  ): Promise<DetectedMedia | null> {
    const handle = await open(
      filePath,
      'r',
    );

    try {
      const buffer = Buffer.alloc(8192);
      const { bytesRead } = await handle.read(
        buffer,
        0,
        buffer.length,
        0,
      );

      const header =
        buffer.subarray(
          0,
          bytesRead,
        );

      return this.detectMediaFromHeader(
        header,
      );
    } finally {
      await handle.close();
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

  private async safeDelete(
    filePath: string,
  ): Promise<void> {
    try {
      await unlink(
        filePath,
      );
    } catch {
      /*
       * Cleanup bersifat best-effort.
       *
       * Error asli validation/database tidak boleh
       * tertimpa hanya karena cleanup file gagal.
       */
    }
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