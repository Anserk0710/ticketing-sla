import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @IsUUID('4', { each: true }) technicianIds!: string[];
  @ApiProperty() @IsUUID() leadTechnicianId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
export class ReassignDto extends CreateAssignmentDto {
  @ApiProperty() @IsString() @MinLength(3) reason!: string;
}
export class UpdateMemberDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isLead?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiredForResolution?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}
