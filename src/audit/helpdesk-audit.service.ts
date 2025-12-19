import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

export type RequestAuditPayload = {
  endpoint: string;
  method: string;
  params?: any;
  requestedAt: Date;
  ip?: string;
  userId?: string;
  accessLevel?: string;
  department?: string;
  statusCode: number;
  durationMs: number;
  level?: LogLevel;
  action?: string;
  entity?: string;
};

export type ChangeAuditPayload = {
  action: string;
  entity?: string;
  userId?: string;
  accessLevel?: string;
  before?: any;
  after?: any;
  endpoint?: string;
  method?: string;
  ip?: string;
  statusCode?: number;
  durationMs?: number;
  level?: LogLevel;
};

@Injectable()
export class HelpdeskAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logRequest(payload: RequestAuditPayload) {
    try {
      await (this.prisma as any).helpdeskAuditLog.create({
        data: {
          endpoint: payload.endpoint,
          method: payload.method,
          params: payload.params ?? undefined,
          requestedAt: payload.requestedAt,
          ip: payload.ip,
          userId: payload.userId,
          accessLevel: payload.accessLevel,
          department: payload.department,
          statusCode: payload.statusCode,
          durationMs: payload.durationMs,
          level: payload.level ?? 'INFO',
          action: payload.action,
          entity: payload.entity,
        },
      });
    } catch (err) {
      // Falha de auditoria não deve quebrar fluxo de negócio
    }
  }

  async logChange(payload: ChangeAuditPayload) {
    try {
      await (this.prisma as any).helpdeskAuditLog.create({
        data: {
          endpoint: payload.endpoint,
          method: payload.method,
          ip: payload.ip,
          userId: payload.userId,
          accessLevel: payload.accessLevel,
          statusCode: payload.statusCode ?? 200,
          durationMs: payload.durationMs ?? 0,
          level: payload.level ?? 'INFO',
          action: payload.action,
          entity: payload.entity,
          before: payload.before,
          after: payload.after,
        },
      });
    } catch (err) {
      // Falha de auditoria não deve quebrar fluxo de negócio
    }
  }

  async listByTicketId(ticketId: string, page = 1, take = 50) {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const pageSize = Math.min(100, Number.isFinite(take) && take > 0 ? take : 50);
    const skip = (safePage - 1) * pageSize;

    const endpointPattern = `%/helpdesk/tickets/${ticketId}%`;
    const idPattern = `%"id":"${ticketId}"%`;
    const ticketIdPattern = `%"ticketId":"${ticketId}"%`;

    const rows: any[] = await (this.prisma as any).$queryRaw`
      SELECT h.*, u."firstName" AS "userFirstName", u."lastName" AS "userLastName", u."avatar" AS "userAvatar"
      FROM "public"."HelpdeskAuditLog" h
      LEFT JOIN "public"."User" u ON u."id" = h."userId"
      WHERE h."endpoint" ILIKE ${endpointPattern}
         OR CAST(h."before" AS TEXT) ILIKE ${idPattern}
         OR CAST(h."after" AS TEXT) ILIKE ${idPattern}
         OR CAST(h."before" AS TEXT) ILIKE ${ticketIdPattern}
         OR CAST(h."after" AS TEXT) ILIKE ${ticketIdPattern}
      ORDER BY h."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${skip}
    `;

    const items = rows.map((r) => ({
      id: r.id,
      endpoint: r.endpoint,
      method: r.method,
      params: r.params,
      requestedAt: r.requestedAt,
      ip: r.ip,
      userId: r.userId,
      accessLevel: r.accessLevel,
      department: r.department,
      statusCode: r.statusCode,
      durationMs: r.durationMs,
      level: r.level,
      action: r.action,
      entity: r.entity,
      before: r.before,
      after: r.after,
      createdAt: r.createdAt,
      userName: [r.userFirstName, r.userLastName].filter(Boolean).join(' ').trim(),
      avatar: r.userAvatar,
    }));

    // Count total for pagination
    const totalRows: Array<{ count: bigint }> = await (this.prisma as any).$queryRaw`
      SELECT COUNT(*)::bigint AS count
      FROM "public"."HelpdeskAuditLog" h
      WHERE h."endpoint" ILIKE ${endpointPattern}
         OR CAST(h."before" AS TEXT) ILIKE ${idPattern}
         OR CAST(h."after" AS TEXT) ILIKE ${idPattern}
         OR CAST(h."before" AS TEXT) ILIKE ${ticketIdPattern}
         OR CAST(h."after" AS TEXT) ILIKE ${ticketIdPattern}
    `;

    const totalItems = Number(totalRows?.[0]?.count ?? 0);
    return {
      items,
      pagination: {
        totalItems,
        pageSize,
        pageNumber: safePage,
        totalPages: Math.ceil(totalItems / pageSize) || 1,
        hasNextPage: skip + pageSize < totalItems,
        hasPreviousPage: safePage > 1,
      },
    };
  }
}