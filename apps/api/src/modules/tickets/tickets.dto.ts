import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  Matches,
} from 'class-validator';

import { Type } from 'class-transformer';

export class CreateTicketDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qrToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  reporterName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  picName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(7)
  @Matches(/^\d+$/, { message: 'Nomor kontak hanya boleh berisi angka 0-9.' })
  contactPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationDetail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  description!: string;

  /*
   * Phase 4:
   * Public complaint WAJIB minimal 1 media.
   */
  @ApiProperty({
    type: [String],
    minItems: 1,
    description:
      'Minimal 1 media complaint. Mendukung foto JPEG/PNG/WEBP dan video MP4.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  mediaIds!: string[];
}

export class TrackTicketDto {
  @ApiProperty()
  @IsString()
  ticketCode!: string;

  @ApiProperty()
  @IsString()
  contactPhone!: string;
}

export class RespondTicketDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  message!: string;

  @ApiProperty()
  @IsUUID()
  priorityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextAction?: string;
}

export class ClassificationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  priorityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class ReasonDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class ResolveTicketDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  summary!: string;
}

export class CloseTicketDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  verificationNote?: string;
}

export class CommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  message!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export enum TicketSortBy {
  TICKET_CODE = 'ticketCode',
  CLIENT_NAME = 'clientName',
  SITE_NAME = 'siteName',
  PRIORITY = 'priority',
  STATUS = 'status',
  CREATED_AT = 'createdAt',
}

export enum TicketSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class TicketQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  priorityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: TicketSortBy,
    default: TicketSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(TicketSortBy)
  sortBy: TicketSortBy = TicketSortBy.CREATED_AT;

  @ApiPropertyOptional({
    enum: TicketSortOrder,
    default: TicketSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(TicketSortOrder)
  sortOrder: TicketSortOrder = TicketSortOrder.DESC;
}

export class RescheduleTicketDto {
  @ApiProperty({
    description: 'Alasan reschedule (wajib)',
  })
  @IsString()
  @MinLength(5)
  reason!: string;

  @ApiProperty({
    description:
      'Jadwal baru dalam format ISO 8601',
  })
  @IsDateString()
  scheduledAt!: string;
}

export class ResumeTicketDto {
  @ApiPropertyOptional({
    description:
      'Catatan opsional saat melanjutkan ticket',
  })
  @IsOptional()
  @IsString()
  note?: string;
}