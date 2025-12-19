import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsScheduler {
  private readonly logger = new Logger(MetricsScheduler.name);
  constructor(private readonly metricsService: MetricsService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron() {
    this.logger.log('Running scheduled estudei metrics collection');
    try {
      await this.metricsService.collect('scheduler');
    } catch (e) {
      this.logger.error('Scheduled metrics collection failed', e as any);
    }
  }
}
