import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { MetricsService } from './metrics.service';
import { MetricsScheduler } from './metrics.scheduler';
import { MetricsController } from './metrics.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [CacheModule.register({ isGlobal: false })],
  providers: [MetricsService, MetricsScheduler, PrismaService],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MetricsModule {}
