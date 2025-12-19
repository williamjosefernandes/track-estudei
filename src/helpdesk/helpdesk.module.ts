import { Module } from '@nestjs/common';
import { HelpDeskController } from './helpdesk.controller';
import { HelpDeskDashboardController } from './helpdesk-dashboard.controller';
import { HelpDeskReportsController } from './helpdesk-reports.controller';
import { HelpDeskService } from './helpdesk.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [HelpDeskController, HelpDeskDashboardController, HelpDeskReportsController],
  providers: [HelpDeskService, PrismaService],
  exports: [HelpDeskService],
})
export class HelpDeskModule {}
