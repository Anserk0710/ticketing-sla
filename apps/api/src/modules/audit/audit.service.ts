import { Injectable } from '@nestjs/common';
import { AuditLog } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  write(input: {
    actorUserId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    before?: any;
    after?: any;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  }): Promise<AuditLog> {
    return this.prisma.auditLog.create({ data: input });
  }
}
