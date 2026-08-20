import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { AuthService } from './auth.service';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, LogoutDto, RefreshDto, ResetPasswordDto } from './auth.dto';

@ApiTags('Authentication')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post('auth/login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.auth.login(dto.email, dto.password, { ip: request.ip, userAgent: request.headers['user-agent'] });
  }

  @Public() @Post('auth/refresh')
  refresh(@Body() dto: RefreshDto, @Req() request: Request) {
    return this.auth.refresh(dto.refreshToken, { ip: request.ip, userAgent: request.headers['user-agent'] });
  }

  @ApiBearerAuth() @Post('auth/logout')
  logout(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto) { return this.auth.logout(user.id, dto.refreshToken); }

  @ApiBearerAuth() @Get('auth/me')
  me(@CurrentUser() user: AuthUser) { return user; }

  @ApiBearerAuth() @Post('auth/change-password')
  change(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) { return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword); }

  @Public() @Post('public/auth/forgot-password')
  forgot(@Body() dto: ForgotPasswordDto, @Req() request: Request) { return this.auth.forgotPassword(dto.email, request.ip); }

  @Public() @Post('public/auth/reset-password')
  reset(@Body() dto: ResetPasswordDto) { return this.auth.resetPassword(dto.token, dto.newPassword); }
}
