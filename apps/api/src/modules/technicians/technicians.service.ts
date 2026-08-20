import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, TechnicianApprovalDecision, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { normalizePhone } from '../../common/utils/phone';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterTechnicianDto } from './technicians.dto';

@Injectable()
export class TechniciansService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly notifications: NotificationsService) {}

  async register(dto: RegisterTechnicianDto) {
    const email = dto.email.trim().toLowerCase();
    const phoneNormalized = normalizePhone(dto.phone);
    const duplicate = await this.prisma.user.findFirst({ where: { OR: [{ email }, { phoneNormalized }] } });
    if (duplicate) throw new ConflictException({ code: 'ACCOUNT_ALREADY_EXISTS', message: 'Email atau nomor telepon sudah digunakan.' });
    const role = await this.prisma.role.findUniqueOrThrow({ where: { name: 'TECHNICIAN' } });
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email, phoneNormalized, passwordHash, displayName: dto.displayName.trim(), status: UserStatus.PENDING_APPROVAL,
        roles: { create: { roleId: role.id } },
        technicianProfile: { create: { employeeCode: dto.employeeCode, skills: dto.skills ?? [] } }
      },
      select: { id: true, email: true, displayName: true, status: true, createdAt: true }
    });
    await this.audit.write({ actorUserId: user.id, action: 'TECHNICIAN_REGISTERED', resourceType: 'user', resourceId: user.id });
    return { ...user, message: 'Registrasi berhasil dan menunggu persetujuan Head/Administrator.' };
  }

  listApprovals() {
    return this.prisma.technicianProfile.findMany({
      where: { user: { status: UserStatus.PENDING_APPROVAL } },
      include: { user: { select: { id: true, displayName: true, email: true, phoneNormalized: true, status: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' }
    });
  }

  async detail(profileId: string) {
    const profile = await this.prisma.technicianProfile.findUnique({
      where: { id: profileId },
      include: { user: { select: { id: true, displayName: true, email: true, phoneNormalized: true, status: true, createdAt: true } }, approvalLogs: { include: { reviewer: { select: { displayName: true } } }, orderBy: { createdAt: 'desc' } } }
    });
    if (!profile) throw new NotFoundException({ code: 'TECHNICIAN_NOT_FOUND', message: 'Teknisi tidak ditemukan.' });
    return profile;
  }

  async approve(profileId: string, reviewerId: string, note?: string) {
    return this.decide(profileId, reviewerId, TechnicianApprovalDecision.APPROVED, note);
  }

  async reject(profileId: string, reviewerId: string, reason: string) {
    if (!reason.trim()) throw new BadRequestException({ code: 'REJECTION_REASON_REQUIRED', message: 'Alasan penolakan wajib diisi.' });
    return this.decide(profileId, reviewerId, TechnicianApprovalDecision.REJECTED, reason);
  }

  private async decide(profileId: string, reviewerId: string, decision: TechnicianApprovalDecision, note?: string) {
    const profile = await this.prisma.technicianProfile.findUnique({ where: { id: profileId }, include: { user: true } });
    if (!profile) throw new NotFoundException({ code: 'TECHNICIAN_NOT_FOUND', message: 'Teknisi tidak ditemukan.' });
    const approved = decision === TechnicianApprovalDecision.APPROVED;
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: profile.userId }, data: { status: approved ? UserStatus.APPROVED : UserStatus.REJECTED } });
      await tx.technicianProfile.update({ where: { id: profile.id }, data: { approvedById: approved ? reviewerId : null, approvedAt: approved ? new Date() : null, rejectionReason: approved ? null : note } });
      await tx.technicianApprovalLog.create({ data: { technicianProfileId: profile.id, reviewerId, decision, note } });
      await this.notifications.createUnique({
        recipientUserId: profile.userId,
        type: approved ? NotificationType.TECHNICIAN_APPROVED : NotificationType.TECHNICIAN_REJECTED,
        title: approved ? 'Akun disetujui' : 'Registrasi ditolak',
        body: approved ? 'Akun teknisi Anda sudah aktif.' : `Registrasi ditolak: ${note}`,
        relatedType: 'user', relatedId: profile.userId, uniqueEventKey: `technician-${decision}-${profile.userId}-${Date.now()}`
      }, tx);
      return updated;
    });
    await this.audit.write({ actorUserId: reviewerId, action: `TECHNICIAN_${decision}`, resourceType: 'technician_profile', resourceId: profile.id, after: { status: result.status, note } });
    return { id: profile.id, userId: profile.userId, status: result.status };
  }

  async suspend(userId: string, actorId: string, reason?: string) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.SUSPENDED } });
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.write({ actorUserId: actorId, action: 'TECHNICIAN_SUSPENDED', resourceType: 'user', resourceId: userId, after: { status: user.status, reason } });
    return { id: user.id, status: user.status };
  }

  async reactivate(userId: string, actorId: string) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.APPROVED } });
    await this.audit.write({ actorUserId: actorId, action: 'TECHNICIAN_REACTIVATED', resourceType: 'user', resourceId: userId, after: { status: user.status } });
    return { id: user.id, status: user.status };
  }

  listAvailable() {
    return this.prisma.user.findMany({
      where: { status: UserStatus.APPROVED, roles: { some: { role: { name: 'TECHNICIAN' } } }, technicianProfile: { isAvailable: true } },
      select: { id: true, displayName: true, email: true, phoneNormalized: true, technicianProfile: { select: { employeeCode: true, skills: true, isAvailable: true } } }, orderBy: { displayName: 'asc' }
    });
  }
}
