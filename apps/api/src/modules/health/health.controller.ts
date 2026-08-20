import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Public() @Get('live') live() { return { status: 'ok', timestamp: new Date().toISOString() }; }
  @Public() @Get('ready') async ready() {
    try { await this.prisma.$queryRaw`SELECT 1`; return { status: 'ready', database: 'up', timestamp: new Date().toISOString() }; }
    catch { throw new ServiceUnavailableException({ code: 'NOT_READY', message: 'Database belum siap.' }); }
  }
}
