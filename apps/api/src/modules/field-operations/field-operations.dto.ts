import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

import { Type } from 'class-transformer';

export class CheckinDto {
  @ApiProperty()
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracyMeters!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deviceCapturedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressSnapshot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  /*
   * Phase 4:
   *
   * CHECKIN:
   * - wajib media
   * - tepat 1
   * - UUID valid
   * - tidak boleh duplicate
   *
   * Tipe image/video akan diverifikasi lagi
   * pada MediaService terhadap database.
   */
  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: 1,
    description:
      'Wajib tepat 1 foto JPEG/PNG/WEBP. Video tidak diizinkan.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  mediaIds!: string[];
}

export class StartWorkDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CompleteWorkDto {
  @ApiProperty()
  @IsString()
  summary!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  /*
   * Phase 4:
   *
   * COMPLETION:
   * - wajib minimal 1
   * - multi upload diperbolehkan
   * - photo/video diperbolehkan
   */
  @ApiProperty({
    type: [String],
    minItems: 1,
    description:
      'Minimal 1 media completion. Mendukung foto JPEG/PNG/WEBP dan video MP4.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  mediaIds!: string[];
}