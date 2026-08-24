import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
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
export class UserDto {
  @ApiProperty() @IsString() @MinLength(2) displayName!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiProperty({ enum: ['HEAD', 'TECHNICIAN'] }) @IsIn(['HEAD', 'TECHNICIAN']) role!: 'HEAD' | 'TECHNICIAN';
  @ApiPropertyOptional({ enum: UserStatus }) @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() employeeCode?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isAvailable?: boolean;
}
export class TemporaryPasswordDto { @ApiProperty() @IsString() @MinLength(3) reason!: string; }
