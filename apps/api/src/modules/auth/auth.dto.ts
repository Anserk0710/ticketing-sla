import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' }) @IsEmail() email!: string;
  @ApiProperty({ example: 'Admin123!' }) @IsString() @MinLength(8) password!: string;
}
export class RefreshDto { @ApiProperty() @IsString() refreshToken!: string; }
export class ChangePasswordDto {
  @ApiProperty() @IsString() currentPassword!: string;
  @ApiProperty() @IsString() @MinLength(8) newPassword!: string;
}
export class ForgotPasswordDto { @ApiProperty() @IsEmail() email!: string; }
export class ResetPasswordDto {
  @ApiProperty() @IsString() token!: string;
  @ApiProperty() @IsString() @MinLength(8) newPassword!: string;
}
export class LogoutDto { @ApiPropertyOptional() @IsOptional() @IsString() refreshToken?: string; }
