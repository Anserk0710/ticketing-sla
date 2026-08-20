import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
    
    // One-time migration to force all RESPOND SLA targets to 7200 seconds (2 hours)
    try {
      const respondInstances = await this.slaInstance.findMany({ where: { slaType: 'RESPOND' } });
      for (const instance of respondInstances) {
        if (instance.targetSeconds !== 7200) {
          const warningAt = new Date(instance.startedAt.getTime() + (7200 * instance.warningThresholdPercent / 100) * 1000);
          const dueAt = new Date(instance.startedAt.getTime() + 7200 * 1000);
          await this.slaInstance.update({ where: { id: instance.id }, data: { targetSeconds: 7200, warningAt, dueAt } });
        }
      }
      await this.slaPolicyVersion.updateMany({ data: { respondTargetSeconds: 7200 } });
    } catch (e) {
      console.error('Migration failed:', e);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
