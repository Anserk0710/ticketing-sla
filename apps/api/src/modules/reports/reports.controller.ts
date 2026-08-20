import { Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { ReportQueryDto } from './reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports & Dashboard')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('reports/tickets') @Permissions('report.read') tickets(@Query() query: ReportQueryDto) { return this.reports.tickets(query); }
  @Get('reports/tickets/summary') @Permissions('report.read') summary(@Query() query: ReportQueryDto) { return this.reports.summary(query); }
  @Get('reports/technicians') @Permissions('report.read') technicians(@Query() query: ReportQueryDto) { return this.reports.technicians(query); }
  @Get('dashboard/summary') @Permissions('report.read') dashboard(@Query() query: ReportQueryDto) { return this.reports.summary(query); }
  @Get('dashboard/sla') @Permissions('report.read') sla(@Query() query: ReportQueryDto) { return this.reports.summary(query); }

  @Post('reports/tickets/export') @Permissions('report.export')
  async export(@Query() query: ReportQueryDto, @CurrentUser() user: AuthUser, @Res() response: Response) {
    const buffer = await this.reports.export(query, user);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename="ticket-report-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    response.send(buffer);
  }
}
