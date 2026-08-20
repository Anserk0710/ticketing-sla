import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CategoryDto, ClientDto, PolicyDto, QrDto, SiteDto, TemporaryPasswordDto } from './master-data.dto';

@ApiTags('Master Data')
@Controller()
export class MasterDataController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

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
  users() { return this.prisma.user.findMany({ select: { id: true, email: true, displayName: true, phoneNormalized: true, status: true, mustChangePassword: true, lastLoginAt: true, createdAt: true, roles: { include: { role: true } }, technicianProfile: true }, orderBy: { createdAt: 'desc' } }); }

  @ApiBearerAuth() @Post('users/:id/temporary-password') @Permissions('user.manage')
  async temporaryPassword(@Param('id') id: string, @Body() dto: TemporaryPasswordDto, @CurrentUser() actor: AuthUser) {
    const temporaryPassword = `Tmp-${randomBytes(5).toString('base64url')}!`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } });
    await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.write({ actorUserId: actor.id, action: 'USER_TEMPORARY_PASSWORD_CREATED', resourceType: 'user', resourceId: id, after: { reason: dto.reason, mustChangePassword: true } });
    return { temporaryPassword, mustChangePassword: true };
  }
}
