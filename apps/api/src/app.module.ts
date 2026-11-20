import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { validateEnvironment } from './config/environment';

import { PrismaModule } from './database/prisma.module';

import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { TechniciansModule } from './modules/technicians/technicians.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { FieldOperationsModule } from './modules/field-operations/field-operations.module';
import { SlaModule } from './modules/sla/sla.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { MediaModule } from './modules/media/media.module';
import { HealthModule } from './modules/health/health.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env',
        '../../.env',
      ],
      validate: validateEnvironment,
    }),

    CommonModule,

    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),

    PrismaModule,
    AuditModule,
    NotificationsModule,
    SlaModule,
    AuthModule,
    TechniciansModule,
    TicketsModule,
    AssignmentsModule,
    FieldOperationsModule,
    ReportsModule,
    MasterDataModule,
    MediaModule,
    HealthModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
})
export class AppModule { }