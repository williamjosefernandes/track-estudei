import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginationResponse } from 'src/common/pagination/pagination-response.dto';
import { HelpdeskAuditLogDto } from './dto/helpdesk-audit-log.dto';
import { AdminAuthGuard } from '../auth/guard/admin-auth.guard';

@ApiTags('Auditoria HelpDesk')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('audit/helpdesk')
export class HelpdeskAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar logs de auditoria do HelpDesk' })
  @ApiResponse({ status: 200, type: PaginationResponse })
  async list(
    @Query('page-number') page?: string,
    @Query('page-size') limit?: string,
    @Query('userId') userId?: string,
    @Query('endpoint') endpoint?: string,
    @Query('method') method?: string,
    @Query('level') level?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<PaginationResponse<HelpdeskAuditLogDto>> {
    const pageNumber = parseInt(page || '1');
    const pageSize = parseInt(limit || '10');

    const where: any = {
      userId: userId || undefined,
      endpoint: endpoint
        ? { contains: endpoint, mode: 'insensitive' }
        : undefined,
      method: method || undefined,
      level: level || undefined,
      requestedAt:
        from || to
          ? {
              gte: from ? new Date(from) : undefined,
              lte: to ? new Date(to) : undefined,
            }
          : undefined,
    };

    const totalItems = await (this.prisma as any).helpdeskAuditLog.count({
      where,
    });
    const items = await (this.prisma as any).helpdeskAuditLog.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      skip: (pageNumber - 1) * pageSize,
      take: pageSize,
    });

    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const pagination = {
      totalItems,
      pageSize,
      pageNumber,
      totalPages,
      previousPage: pageNumber > 1 ? pageNumber - 1 : 0,
      nextPage: pageNumber < totalPages ? pageNumber + 1 : 0,
      lastPage: totalPages,
      hasPreviousPage: pageNumber > 1,
      hasNextPage: pageNumber < totalPages,
    };

    return new PaginationResponse(items, pagination);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Métricas dos logs de auditoria do HelpDesk' })
  async metrics(
    @Query('userId') userId?: string,
    @Query('endpoint') endpoint?: string,
    @Query('method') method?: string,
    @Query('level') level?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const where: any = {
      userId: userId || undefined,
      endpoint: endpoint ? { contains: endpoint, mode: 'insensitive' } : undefined,
      method: method || undefined,
      level: level || undefined,
      createdAt:
        from || to
          ? {
              gte: from ? new Date(from) : undefined,
              lte: to ? new Date(to) : undefined,
            }
          : undefined,
    };

    const [overall, byLevelRows, byMethodRows, byStatusCodeRowsRaw, topEndpointsRowsRaw, recentForDays] = await Promise.all([
      (this.prisma as any).helpdeskAuditLog.aggregate({ _count: { _all: true }, _avg: { durationMs: true }, where }),
      (this.prisma as any).helpdeskAuditLog.groupBy({ by: ['level'], where, _count: { _all: true } }),
      (this.prisma as any).helpdeskAuditLog.groupBy({ by: ['method'], where, _count: { _all: true } }),
      (this.prisma as any).helpdeskAuditLog.groupBy({ by: ['statusCode'], where, _count: { _all: true } }),
      (this.prisma as any).helpdeskAuditLog.groupBy({ by: ['endpoint'], where, _count: { _all: true } }),
      (this.prisma as any).helpdeskAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 2000, select: { createdAt: true, action: true } }),
    ]);

    const byDayMap = new Map<string, number>();
    const byActionTypeMap = new Map<string, number>([
      ['REQUEST', 0],
      ['CHANGE', 0],
    ]);
    for (const r of recentForDays) {
      const day = new Date(r.createdAt);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      byDayMap.set(key, (byDayMap.get(key) || 0) + 1);
      const type = r.action ? 'CHANGE' : 'REQUEST';
      byActionTypeMap.set(type, (byActionTypeMap.get(type) || 0) + 1);
    }
    const byDay = Array.from(byDayMap.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 30);

    const byLevel = byLevelRows
      .sort((a: any, b: any) => Number(b?._count?._all || 0) - Number(a?._count?._all || 0))
      .map((r: any) => ({ level: r.level, total: Number(r._count?._all || 0) }));

    const byMethod = byMethodRows
      .sort((a: any, b: any) => Number(b?._count?._all || 0) - Number(a?._count?._all || 0))
      .map((r: any) => ({ method: r.method, total: Number(r._count?._all || 0) }));

    const byStatusCode = byStatusCodeRowsRaw
      .sort((a: any, b: any) => Number(b?._count?._all || 0) - Number(a?._count?._all || 0))
      .slice(0, 10)
      .map((r: any) => ({ statusCode: Number(r.statusCode), total: Number(r._count?._all || 0) }));

    const topEndpoints = topEndpointsRowsRaw
      .sort((a: any, b: any) => Number(b?._count?._all || 0) - Number(a?._count?._all || 0))
      .slice(0, 10)
      .map((r: any) => ({ endpoint: r.endpoint, total: Number(r._count?._all || 0) }));

    return {
      totalLogs: Number(overall?._count?._all || 0),
      avgDurationMs: Number(overall?._avg?.durationMs || 0) || 0,
      byLevel,
      byMethod,
      byStatusCode,
      topEndpoints,
      byDay,
      byActionType: Array.from(byActionTypeMap.entries()).map(([type, total]) => ({ type, total })),
      filters: { userId, endpoint, method, level, from, to },
    };
  }
}