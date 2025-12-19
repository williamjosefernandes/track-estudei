import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { HelpdeskAuditController } from './helpdesk-audit.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { HelpdeskAuditService } from './helpdesk-audit.service';
import { HelpdeskAuditInterceptor } from './helpdesk-audit.interceptor';

@Module({
  controllers: [AuditController, HelpdeskAuditController],
  providers: [AuditService, PrismaService, HelpdeskAuditService, HelpdeskAuditInterceptor],
  exports: [HelpdeskAuditService, HelpdeskAuditInterceptor],
})
export class AuditModule {}
