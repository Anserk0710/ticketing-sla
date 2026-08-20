import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Permissions('audit.read')
  async list(@Query('page') pageText = '1', @Query('pageSize') pageSizeText = '30') {
    const page = Math.max(1, Number(pageText) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(pageSizeText) || 30));
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        include: { actor: { select: { id: true, displayName: true, email: true } } }
      }),
      this.prisma.auditLog.count()
    ]);
    return { data, meta: { page, pageSize, total } };
  }
}
