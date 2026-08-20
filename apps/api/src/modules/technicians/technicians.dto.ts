import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterTechnicianDto {
  @ApiProperty() @IsString() displayName!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() phone!: string;
  @ApiProperty() @IsString() @MinLength(8) password!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employeeCode?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[];
}
export class ApprovalDecisionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
export class RejectTechnicianDto {
  @ApiProperty() @IsString() @MinLength(3) reason!: string;
}
