import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly email: EmailService
  ) {}

  async login(email: string, password: string, metadata?: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !valid) {
      await this.audit.write({ action: 'AUTH_LOGIN_FAILED', resourceType: 'user', resourceId: user?.id, ipAddress: metadata?.ip, userAgent: metadata?.userAgent });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Email atau password salah.' });
    }
    if (user.status !== UserStatus.APPROVED) {
      throw new UnauthorizedException({ code: 'ACCOUNT_NOT_ACTIVE', message: 'Akun belum aktif atau sedang dinonaktifkan.' });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const authUser = await this.getAuthUser(user.id);
    const tokens = await this.issueTokens(authUser, metadata);
    await this.audit.write({ actorUserId: user.id, action: 'AUTH_LOGIN_SUCCEEDED', resourceType: 'user', resourceId: user.id, ipAddress: metadata?.ip, userAgent: metadata?.userAgent });
    return { user: authUser, ...tokens };
  }

  async refresh(refreshToken: string, metadata?: { ip?: string; userAgent?: string }) {
    let payload: { sub: string; type: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        issuer: this.config.get<string>('JWT_ISSUER', 'ticketing-sla-api'),
        audience: this.config.get<string>('JWT_AUDIENCE', 'ticketing-sla-web')
      });
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token tidak valid.' });
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException({ code: 'INVALID_TOKEN_TYPE', message: 'Token tidak valid.' });
    const tokenHash = this.hash(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({ where: { userId: payload.sub, tokenHash, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!stored) throw new UnauthorizedException({ code: 'REFRESH_TOKEN_REVOKED', message: 'Session sudah tidak berlaku.' });
    const authUser = await this.getAuthUser(payload.sub);
    if (authUser.status !== UserStatus.APPROVED) throw new UnauthorizedException({ code: 'ACCOUNT_NOT_ACTIVE', message: 'Akun tidak aktif.' });
    const next = await this.issueTokens(authUser, metadata);
    const nextHash = this.hash(next.refreshToken);
    const nextStored = await this.prisma.refreshToken.findFirstOrThrow({ where: { tokenHash: nextHash } });
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date(), replacedById: nextStored.id } });
    return { user: authUser, ...next };
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({ where: { userId, tokenHash: this.hash(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
    } else {
      await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return { success: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException({ code: 'CURRENT_PASSWORD_INVALID', message: 'Password saat ini salah.' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
    ]);
    await this.audit.write({ actorUserId: userId, action: 'AUTH_PASSWORD_CHANGED', resourceType: 'user', resourceId: userId });
    return { success: true };
  }

  async forgotPassword(email: string, requestedIp?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    let developmentToken: string | undefined;
    if (user) {
      const token = randomBytes(32).toString('hex');
      developmentToken = token;
      await this.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: this.hash(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000), requestedIp } });
      // Await SMTP so serverless runtimes do not end the request before sending.
      const delivery = await this.email.sendPasswordResetEmail(user.email, token);
      await this.audit.write({ actorUserId: user.id, action: 'AUTH_PASSWORD_RESET_REQUESTED', resourceType: 'user', resourceId: user.id, ipAddress: requestedIp, after: { emailStatus: delivery.status } });
    }
    return {
      message: 'Jika email terdaftar, instruksi reset password akan dikirim.',
      ...(this.config.get('NODE_ENV') !== 'production' && this.config.get('APP_ENV') !== 'PRODUCTION' && developmentToken ? { developmentToken } : {})
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: this.hash(token) } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException({ code: 'RESET_TOKEN_INVALID', message: 'Token reset tidak valid atau kedaluwarsa.' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash, mustChangePassword: false } }),
      this.prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } })
    ]);
    await this.audit.write({ actorUserId: record.userId, action: 'AUTH_PASSWORD_RESET_COMPLETED', resourceType: 'user', resourceId: record.userId });
    return { success: true };
  }

  async getAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
    });
    return {
      id: user.id, email: user.email, displayName: user.displayName, status: user.status, mustChangePassword: user.mustChangePassword,
      roles: user.roles.map((item) => item.role.name),
      permissions: [...new Set(user.roles.flatMap((item) => item.role.permissions.map((entry) => entry.permission.code)))]
    };
  }

  private async issueTokens(user: AuthUser, metadata?: { ip?: string; userAgent?: string }) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, roles: user.roles, type: 'access' },
      { expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as any }
    );
    const refreshDays = Number(this.config.get('JWT_REFRESH_TTL_DAYS', 7));
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, type: 'refresh', jti: randomUUID() },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: `${refreshDays}d` as any,
        issuer: this.config.get<string>('JWT_ISSUER', 'ticketing-sla-api'),
        audience: this.config.get<string>('JWT_AUDIENCE', 'ticketing-sla-web')
      }
    );
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id, tokenHash: this.hash(refreshToken), expiresAt: new Date(Date.now() + refreshDays * 86400000),
        ipAddress: metadata?.ip, userAgent: metadata?.userAgent
      }
    });
    return { accessToken, refreshToken, expiresIn: 900 };
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
