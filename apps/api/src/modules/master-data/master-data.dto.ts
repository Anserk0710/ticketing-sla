import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEmail, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ClientDto { @ApiProperty() @IsString() code!: string; @ApiProperty() @IsString() name!: string; @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean; }
export class SiteDto {
  @ApiProperty() @IsUUID() clientId!: string; @ApiProperty() @IsString() code!: string; @ApiProperty() @IsString() name!: string; @ApiProperty() @IsString() address!: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() latitude?: number; @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) allowedCheckinRadius?: number; @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
export class CategoryDto { @ApiProperty() @IsString() code!: string; @ApiProperty() @IsString() name!: string; @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() displayOrder?: number; @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean; }
export class QrDto { @ApiProperty() @IsUUID() siteId!: string; @ApiProperty() @IsString() token!: string; @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string; }
export class PolicyDto {
  @ApiProperty() @IsUUID() priorityId!: string; @ApiProperty() @Type(() => Number) @IsInt() @Min(1) respondTargetSeconds!: number; @ApiProperty() @Type(() => Number) @IsInt() @Min(1) workTargetSeconds!: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) warningThresholdPercent?: number; @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveFrom?: string;
}
export class TemporaryPasswordDto { @ApiProperty() @IsString() @MinLength(3) reason!: string; }
