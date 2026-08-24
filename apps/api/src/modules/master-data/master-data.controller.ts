import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { normalizePhone } from '../../common/utils/phone';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CategoryDto, ClientDto, PolicyDto, QrDto, SiteDto, TemporaryPasswordDto, UserDto } from './master-data.dto';

@ApiTags('Master Data')
@Controller()
export class MasterDataController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private readonly userSelect = {
    id: true, email: true, displayName: true, phoneNormalized: true, status: true, mustChangePassword: true,
    lastLoginAt: true, createdAt: true, roles: { include: { role: true } }, technicianProfile: true
  } as const;

  @Public() @Get('public/catalog')
  async publicCatalog() {
    const [categories, priorities, sites] = await Promise.all([
      this.prisma.ticketCategory.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' } }),
      this.prisma.ticketPriority.findMany({ where: { isActive: true }, orderBy: { severityOrder: 'asc' } }),
      this.prisma.site.findMany({ where: { isActive: true }, include: { client: true }, orderBy: { name: 'asc' } })
    ]);
    return { categories, priorities, sites };
  }

  @ApiBearerAuth() @Get('clients') @Permissions('client.read')
  clients() { return this.prisma.client.findMany({ include: { _count: { select: { sites: true } } }, orderBy: { name: 'asc' } }); }
  @ApiBearerAuth() @Post('clients') @Permissions('client.manage')
  createClient(@Body() dto: ClientDto) { return this.prisma.client.create({ data: dto }); }
  @ApiBearerAuth() @Patch('clients/:id') @Permissions('client.manage')
  updateClient(@Param('id') id: string, @Body() dto: ClientDto) { return this.prisma.client.update({ where: { id }, data: dto }); }

  @ApiBearerAuth() @Get('sites') @Permissions('site.read')
  sites() { return this.prisma.site.findMany({ include: { client: true, qrCodes: true }, orderBy: { name: 'asc' } }); }
  @ApiBearerAuth() @Post('sites') @Permissions('site.manage')
  createSite(@Body() dto: SiteDto) { return this.prisma.site.create({ data: dto }); }
  @ApiBearerAuth() @Patch('sites/:id') @Permissions('site.manage')
  updateSite(@Param('id') id: string, @Body() dto: SiteDto) { return this.prisma.site.update({ where: { id }, data: dto }); }

  @ApiBearerAuth() @Get('categories') @Permissions('catalog.read')
  categories() { return this.prisma.ticketCategory.findMany({ orderBy: { displayOrder: 'asc' } }); }
  @ApiBearerAuth() @Post('categories') @Permissions('catalog.manage')
  createCategory(@Body() dto: CategoryDto) { return this.prisma.ticketCategory.create({ data: dto }); }
  @ApiBearerAuth() @Patch('categories/:id') @Permissions('catalog.manage')
  updateCategory(@Param('id') id: string, @Body() dto: CategoryDto) { return this.prisma.ticketCategory.update({ where: { id }, data: dto }); }

  @ApiBearerAuth() @Get('priorities') @Permissions('catalog.read')
  priorities() { return this.prisma.ticketPriority.findMany({ include: { policies: { orderBy: { version: 'desc' }, take: 1 } }, orderBy: { severityOrder: 'asc' } }); }

  @ApiBearerAuth() @Get('qr-codes') @Permissions('site.read')
  qrCodes() { return this.prisma.qrCode.findMany({ include: { site: { include: { client: true } } }, orderBy: { createdAt: 'desc' } }); }
  @ApiBearerAuth() @Post('qr-codes') @Permissions('site.manage')
  createQr(@Body() dto: QrDto, @CurrentUser() user: AuthUser) { return this.prisma.qrCode.create({ data: { siteId: dto.siteId, token: dto.token, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined, createdById: user.id } }); }

  @ApiBearerAuth() @Post('sla/policies') @Permissions('sla.policy.manage')
  async createPolicy(@Body() dto: PolicyDto, @CurrentUser() user: AuthUser) {
    const latest = await this.prisma.slaPolicyVersion.findFirst({ where: { priorityId: dto.priorityId }, orderBy: { version: 'desc' } });
    const item = await this.prisma.slaPolicyVersion.create({ data: {
      priorityId: dto.priorityId, version: (latest?.version ?? 0) + 1, respondTargetSeconds: dto.respondTargetSeconds,
      workTargetSeconds: dto.workTargetSeconds, warningThresholdPercent: dto.warningThresholdPercent ?? 75,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(), createdById: user.id
    }});
    await this.audit.write({ actorUserId: user.id, action: 'SLA_POLICY_CREATED', resourceType: 'sla_policy_version', resourceId: item.id, after: { version: item.version, priorityId: item.priorityId } });
    return item;
  }

  @ApiBearerAuth() @Get('users') @Permissions('user.read')
  users() { return this.prisma.user.findMany({ select: this.userSelect, orderBy: { createdAt: 'desc' } }); }

  @ApiBearerAuth() @Post('users') @Permissions('user.manage')
  async createUser(@Body() dto: UserDto, @CurrentUser() actor: AuthUser) {
    const input = this.normalizeUserInput(dto);
    await this.ensureUniqueUserContact(input.email, input.phoneNormalized);
    const temporaryPassword = `Tmp-${randomBytes(5).toString('base64url')}!`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUniqueOrThrow({ where: { name: input.role } });
      return tx.user.create({
        data: {
          email: input.email, displayName: input.displayName, phoneNormalized: input.phoneNormalized,
          passwordHash, status: input.status, mustChangePassword: true,
          roles: { create: { roleId: role.id } },
          ...(input.role === 'TECHNICIAN' ? {
            technicianProfile: {
              create: {
                employeeCode: input.employeeCode, skills: input.skills, isAvailable: input.isAvailable ?? true,
                approvedById: input.status === UserStatus.APPROVED ? actor.id : null,
                approvedAt: input.status === UserStatus.APPROVED ? new Date() : null
              }
            }
          } : {})
        },
        select: this.userSelect
      });
    });
    await this.audit.write({ actorUserId: actor.id, action: 'USER_CREATED', resourceType: 'user', resourceId: user.id, after: { email: user.email, role: input.role, status: user.status } });
    return { user, temporaryPassword, mustChangePassword: true };
  }

  @ApiBearerAuth() @Patch('users/:id') @Permissions('user.manage')
  async updateUser(@Param('id') id: string, @Body() dto: UserDto, @CurrentUser() actor: AuthUser) {
    const input = this.normalizeUserInput(dto);
    const current = await this.getManagedUserOrThrow(id);
    const currentRoles = current.roles.map((item) => item.role.name);
    const roleChanged = currentRoles.length !== 1 || currentRoles[0] !== input.role;
    if (id === actor.id && (roleChanged || input.status !== UserStatus.APPROVED)) {
      throw new BadRequestException({ code: 'CANNOT_RESTRICT_SELF', message: 'Anda tidak dapat mengubah role atau menonaktifkan akun sendiri.' });
    }
    await this.ensureUniqueUserContact(input.email, input.phoneNormalized, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUniqueOrThrow({ where: { name: input.role } });
      await tx.user.update({
        where: { id },
        data: { email: input.email, displayName: input.displayName, phoneNormalized: input.phoneNormalized, status: input.status }
      });
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.create({ data: { userId: id, roleId: role.id } });
      if (input.role === 'TECHNICIAN') {
        const profile = await tx.technicianProfile.findUnique({ where: { userId: id } });
        const isApproved = input.status === UserStatus.APPROVED;
        await tx.technicianProfile.upsert({
          where: { userId: id },
          update: {
            employeeCode: input.employeeCode, skills: input.skills, isAvailable: input.isAvailable ?? profile?.isAvailable ?? true,
            approvedById: isApproved ? (profile?.approvedById ?? actor.id) : null,
            approvedAt: isApproved ? (profile?.approvedAt ?? new Date()) : null,
            rejectionReason: isApproved ? null : profile?.rejectionReason
          },
          create: {
            userId: id, employeeCode: input.employeeCode, skills: input.skills, isAvailable: input.isAvailable ?? true,
            approvedById: isApproved ? actor.id : null,
            approvedAt: isApproved ? new Date() : null
          }
        });
      } else {
        await tx.technicianProfile.deleteMany({ where: { userId: id } });
      }
      if (roleChanged || input.status !== UserStatus.APPROVED) {
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return tx.user.findUniqueOrThrow({ where: { id }, select: this.userSelect });
    });
    await this.audit.write({
      actorUserId: actor.id, action: 'USER_UPDATED', resourceType: 'user', resourceId: id,
      before: { email: current.email, role: currentRoles, status: current.status },
      after: { email: updated.email, role: input.role, status: updated.status }
    });
    return updated;
  }

  @ApiBearerAuth() @Delete('users/:id') @Permissions('user.manage')
  async deleteUser(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    if (id === actor.id) throw new BadRequestException({ code: 'CANNOT_DELETE_SELF', message: 'Anda tidak dapat menonaktifkan akun sendiri.' });
    const current = await this.getManagedUserOrThrow(id);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      return tx.user.update({ where: { id }, data: { status: UserStatus.DISABLED }, select: this.userSelect });
    });
    await this.audit.write({ actorUserId: actor.id, action: 'USER_DISABLED', resourceType: 'user', resourceId: id, before: { status: current.status }, after: { status: updated.status } });
    return { success: true, user: updated };
  }

  @ApiBearerAuth() @Post('users/:id/temporary-password') @Permissions('user.manage')
  async temporaryPassword(@Param('id') id: string, @Body() dto: TemporaryPasswordDto, @CurrentUser() actor: AuthUser) {
    await this.getManagedUserOrThrow(id);
    const temporaryPassword = `Tmp-${randomBytes(5).toString('base64url')}!`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } });
    await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.write({ actorUserId: actor.id, action: 'USER_TEMPORARY_PASSWORD_CREATED', resourceType: 'user', resourceId: id, after: { reason: dto.reason, mustChangePassword: true } });
    return { temporaryPassword, mustChangePassword: true };
  }

  private normalizeUserInput(dto: UserDto) {
    const email = dto.email.trim().toLowerCase();
    const displayName = dto.displayName.trim();
    if (!displayName) throw new BadRequestException({ code: 'DISPLAY_NAME_REQUIRED', message: 'Nama user wajib diisi.' });
    const rawPhone = dto.phone?.trim();
    const normalizedPhone = rawPhone ? normalizePhone(rawPhone) : '';
    const phoneNormalized = normalizedPhone || null;
    return {
      email,
      displayName,
      phoneNormalized,
      role: dto.role,
      status: dto.status ?? UserStatus.APPROVED,
      employeeCode: dto.employeeCode?.trim() || null,
      skills: dto.skills?.map((skill) => skill.trim()).filter(Boolean) ?? [],
      isAvailable: dto.isAvailable
    };
  }

  private async ensureUniqueUserContact(email: string, phoneNormalized: string | null, excludeId?: string) {
    const duplicate = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, ...(phoneNormalized ? [{ phoneNormalized }] : [])],
        ...(excludeId ? { NOT: { id: excludeId } } : {})
      },
      select: { id: true }
    });
    if (duplicate) throw new ConflictException({ code: 'USER_CONTACT_ALREADY_EXISTS', message: 'Email atau nomor telepon sudah digunakan.' });
  }

  private async getManagedUserOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: true } }, technicianProfile: true } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User tidak ditemukan.' });
    const roleNames = user.roles.map((item) => item.role.name);
    if (roleNames.includes('ADMINISTRATOR') || !roleNames.some((role) => role === 'HEAD' || role === 'TECHNICIAN')) {
      throw new BadRequestException({ code: 'USER_ROLE_NOT_MANAGED', message: 'CRUD ini hanya untuk user Head atau Teknisi.' });
    }
    return user;
  }
}
