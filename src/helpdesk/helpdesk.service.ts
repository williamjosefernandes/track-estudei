import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationResponse } from '../common/pagination/pagination-response.dto';
import { PaginationInfo } from '../common/pagination/pagination-info-response.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { TicketResponseDto } from './dto/ticket-response.dto';
import { CreateTicketRequestDto } from './dto/create-ticket-request.dto';
import { HelpdeskAuditService } from '../audit/helpdesk-audit.service';
import {
  DashboardOverviewResponseDto,
  DashboardIndicatorsResponseDto,
  PriorityDistributionResponseDto,
  SlaAlertItemDto,
  SlaAlertsQueryDto,
  ErrorEndpointCountDto,
  ErrorEndpointRecentDto,
} from './dto/dashboard.dto';
import {
  TicketReportQueryDto,
  TicketReportResponseDto,
  TicketReportDailyItemDto,
  TicketReportSeriesItemDto,
  TicketReportMetadataDto,
  TicketProjectionItemDto,
} from './dto/ticket-report.dto';
import { Prisma, $Enums } from '@prisma/client';

type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

@Injectable()
export class HelpDeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: HelpdeskAuditService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private readonly CLOSED_STATUSES = ['closed', 'CLOSED', 'RESOLVED'];
  private readonly IN_PROGRESS_STATUSES = ['in_progress', 'IN_PROGRESS'];
  private readonly OPEN_STATUSES = ['open', 'OPEN'];

  private readonly PRIORITY_MAP: Record<
    string,
    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  > = {
    low: 'LOW',
    baixa: 'LOW',
    LOW: 'LOW',
    medium: 'MEDIUM',
    media: 'MEDIUM',
    MÉDIA: 'MEDIUM',
    MEDIUM: 'MEDIUM',
    high: 'HIGH',
    alta: 'HIGH',
    HIGH: 'HIGH',
    critical: 'CRITICAL',
    critica: 'CRITICAL',
    crítica: 'CRITICAL',
    CRITICAL: 'CRITICAL',
  } as any;

  private readonly SLA_THRESHOLDS_HOURS: Record<
    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    number
  > = {
    LOW: 72,
    MEDIUM: 48,
    HIGH: 24,
    CRITICAL: 8,
  };

  // ===== Helpers para relatórios =====
  private parseDateOnly(dateStr: string): Date {
    // dateStr no formato YYYY-MM-DD
    const [y, m, d] = dateStr.split('-').map((x) => parseInt(x, 10));
    if (!y || !m || !d)
      throw new BadRequestException(
        'Formato de data inválido, esperado YYYY-MM-DD',
      );
    const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    if (isNaN(dt.getTime())) throw new BadRequestException('Data inválida');
    return dt;
  }

  private toDateStr(dt: Date): string {
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private isWeekend(dt: Date): boolean {
    const day = dt.getUTCDay();
    return day === 0 || day === 6; // domingo(0) ou sábado(6)
  }

  private isFixedHolidayBR(dt: Date): boolean {
    // Feriados nacionais fixos (sem considerar móveis como Carnaval/Páscoa/Corpus Christi)
    const mmdd = `${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    const fixed = new Set([
      '01-01', // Confraternização Universal
      '04-21', // Tiradentes
      '05-01', // Dia do Trabalho
      '09-07', // Independência
      '10-12', // Nossa Senhora Aparecida
      '11-02', // Finados
      '11-15', // Proclamação da República
      '12-25', // Natal
    ]);
    return fixed.has(mmdd);
  }

  private countBusinessDays(start: Date, end: Date): number {
    // Contagem inclusiva, UTC
    let count = 0;
    const cur = new Date(start);
    while (cur.getTime() <= end.getTime()) {
      if (!this.isWeekend(cur) && !this.isFixedHolidayBR(cur)) count++;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return count;
  }

  private daysDiffInclusive(start: Date, end: Date): number {
    const ms = end.getTime() - start.getTime();
    return Math.floor(ms / 86_400_000) + 1;
  }

  // ===== Relatório de Tickets =====
  async getTicketReport(
    query: TicketReportQueryDto,
  ): Promise<TicketReportResponseDto> {
    const maxDaysAllowed = 180; // limite para evitar consultas muito extensas

    // Validações básicas de datas
    const start = this.parseDateOnly(query.startDate);
    const end = this.parseDateOnly(query.endDate);
    if (end.getTime() < start.getTime())
      throw new BadRequestException('endDate deve ser >= startDate');

    const totalDays = this.daysDiffInclusive(start, end);
    if (totalDays > maxDaysAllowed)
      throw new BadRequestException('Período muito extenso');

    // Valida categoria existente se fornecida
    if (query.category) {
      const exists = await this.prisma.ticket.count({
        where: { category: query.category },
      });
      if (!exists) throw new NotFoundException('Categoria inexistente');
    }

    // Nesta versão, o cache depende do total dos últimos 30 dias para invalidar mudanças significativas.

    // Where base
    const whereBase: any = {
      createdAt: { gte: start, lte: new Date(end.getTime() + 86_399_000) }, // até 23:59:59 UTC
      ...(query.category ? { category: query.category } : {}),
    };

    // Dias úteis atual
    const workingDaysCurrent = this.countBusinessDays(start, end);
    // Série diária (SQL otimizado)
    const endInclusive = new Date(end.getTime() + 86_399_000);
    const whereCategory = query.category
      ? Prisma.sql`AND "category" = ${query.category}`
      : Prisma.sql``;
    const rows = await this.prisma.$queryRaw<{ dt: Date; total: number }[]>(
      Prisma.sql`
        SELECT date_trunc('day', "createdAt")::date AS dt, COUNT(*)::int AS total
        FROM "Ticket"
        WHERE "createdAt" BETWEEN ${start} AND ${endInclusive}
        ${whereCategory}
        GROUP BY dt
        ORDER BY dt
      `,
    );
    const dataHistorical: TicketReportDailyItemDto[] = rows.map((r) => ({
      date: this.toDateStr(new Date(r.dt)),
      total: Number(r.total),
      quantidade_real: Number(r.total),
    }));
    const totalTickets = dataHistorical.reduce(
      (acc, i) => acc + (i.total || 0),
      0,
    );
    const rateCurrent = totalTickets / Math.max(1, workingDaysCurrent);

    // Período anterior (mesma duração, imediatamente antes)
    const prevStart = new Date(start.getTime());
    const prevEnd = new Date(end.getTime());
    prevStart.setUTCDate(prevStart.getUTCDate() - totalDays);
    prevEnd.setUTCDate(prevEnd.getUTCDate() - totalDays);

    const wherePrev: any = {
      createdAt: {
        gte: prevStart,
        lte: new Date(prevEnd.getTime() + 86_399_000),
      },
      ...(query.category ? { category: query.category } : {}),
    };
    const totalPrev = await this.prisma.ticket.count({ where: wherePrev });
    const workingDaysPrev = this.countBusinessDays(prevStart, prevEnd);
    const ratePrev = totalPrev / Math.max(1, workingDaysPrev);

    // Variação percentual comparando taxas por dia útil
    const variacao =
      ratePrev > 0
        ? Number((((rateCurrent - ratePrev) / ratePrev) * 100).toFixed(2))
        : rateCurrent > 0
          ? 100
          : 0;

    // ===== Série contínua de 30 dias (preenchendo faltantes com 0) =====
    const dateToTotalMap = new Map<string, number>();
    for (const item of dataHistorical)
      dateToTotalMap.set(item.date, item.total || 0);

    const historyWindow = 30;
    const forecastHorizon = 7;
    const historyDates: string[] = [];
    const seriesCounts: number[] = [];
    for (let i = historyWindow - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() - i);
      const ds = this.toDateStr(d);
      historyDates.push(ds);
      seriesCounts.push(dateToTotalMap.get(ds) ?? 0);
    }

    const totalLast30 = seriesCounts.reduce((acc, v) => acc + v, 0);
    const cacheKey = `ticketReport:${query.category || 'ALL'}:${this.toDateStr(start)}:${this.toDateStr(end)}:sum30:${totalLast30}`;
    const cached = await this.cache.get<TicketReportResponseDto>(cacheKey);
    if (cached) {
      return {
        ...cached,
        metadados: {
          ...cached.metadados,
          cache: {
            ...(cached.metadados?.cache || { ttlSegundos: 300000 }),
            hit: true,
          },
        },
      };
    }

    // ===== Projeção ARIMA para próximos 7 dias (AutoARIMA) =====
    // Import dinâmica para evitar conflitos de tipos CJS
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ARIMA = require('arima');
    let pred: number[] = [];
    let errors: number[] = [];
    try {
      const model = new ARIMA({ auto: true, verbose: false }).train(
        seriesCounts,
      );
      const result = model.predict(forecastHorizon);
      pred = Array.from(result[0] || []);
      errors = Array.from(result[1] || []);
    } catch (e) {
      // Em caso de falha na modelagem, projetar como média móvel simples
      const mean =
        seriesCounts.reduce((a, b) => a + b, 0) /
        Math.max(1, seriesCounts.length);
      pred = Array(forecastHorizon).fill(mean);
      errors = Array(forecastHorizon).fill(0.0);
    }

    // Intervalo de confiança 95% e tendência
    const z95 = 1.96;
    const last7 = seriesCounts.slice(Math.max(0, seriesCounts.length - 7));
    const baseline =
      last7.reduce((a, b) => a + b, 0) / Math.max(1, last7.length);

    const projectedSeries: TicketReportSeriesItemDto[] = [];
    for (let i = 0; i < forecastHorizon; i++) {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() + (i + 1));
      const ds = this.toDateStr(d);
      const p = Math.max(0, Math.round(pred[i] ?? 0));
      const se = Math.sqrt(Math.max(0, errors[i] ?? 0));
      const margin = Math.round(z95 * se);
      const lower = Math.max(0, p - margin);
      const upper = p + margin;
      // tendência comparada a baseline dos últimos 7 dias
      const diffRatio =
        baseline > 0 ? (p - baseline) / baseline : p > 0 ? 1 : 0;
      const tendencia: 'aumento' | 'diminuicao' | 'estabilidade' =
        diffRatio > 0.05
          ? 'aumento'
          : diffRatio < -0.05
            ? 'diminuicao'
            : 'estabilidade';
      projectedSeries.push({
        data: ds,
        quantidade_projetada: p,
        intervalo_confianca: { inferior: lower, superior: upper },
        tendencia,
      });
    }

    const historicalSeries: TicketReportSeriesItemDto[] = historyDates.map(
      (ds, idx) => ({
        data: ds,
        quantidade_real: seriesCounts[idx],
      }),
    );

    // ===== Métricas de qualidade (RMSE, R²) via validação walk-forward =====
    let r2: number | undefined;
    let rmse: number | undefined;
    const trainingWindow = Math.max(1, seriesCounts.length - 7);
    if (trainingWindow >= 10) {
      try {
        const train = seriesCounts.slice(0, trainingWindow);
        const test = seriesCounts.slice(trainingWindow);
        const model2 = new ARIMA({ auto: true, verbose: false }).train(train);
        const res2 = model2.predict(test.length);
        const pred2: number[] = Array.from(res2[0] || []);
        const residuals = test.map((v, i) => v - (pred2[i] ?? 0));
        const ssr = residuals.reduce((acc, e) => acc + e * e, 0);
        const meanTest =
          test.reduce((a, b) => a + b, 0) / Math.max(1, test.length);
        const sst = test.reduce((acc, v) => acc + Math.pow(v - meanTest, 2), 0);
        rmse = Math.sqrt(ssr / Math.max(1, test.length));
        r2 = sst > 0 ? 1 - ssr / sst : 1;
        if (typeof r2 === 'number') r2 = Number(r2.toFixed(4));
        if (typeof rmse === 'number') rmse = Number(rmse.toFixed(4));
      } catch {}
    }

    const metadados: TicketReportMetadataDto = {
      projectionMethod: 'ARIMA',
      confidenceLevel: 0.95,
      r2,
      rmse,
      ordenacao: 'asc',
      trainingWindow,
      forecastHorizon,
      lastDate: this.toDateStr(end),
      category: query.category,
      startDate: this.toDateStr(start),
      endDate: this.toDateStr(end),
      workingDays: workingDaysCurrent,
      previousWorkingDays: workingDaysPrev,
      cache: { ttlSegundos: 300000, hit: false },
    };

    // `data` com histórico do período solicitado + projeção de 7 dias
    const dataProjection: TicketReportDailyItemDto[] = projectedSeries.map(
      (p) => ({
        date: p.data,
        quantidade_projetada: p.quantidade_projetada,
        intervalo_confianca: p.intervalo_confianca,
        tendencia: p.tendencia,
      }),
    );
    const data: TicketReportDailyItemDto[] = [
      ...dataHistorical,
      ...dataProjection,
    ];

    const tickets: TicketProjectionItemDto[] = dataHistorical.map((i) => ({
      date: i.date,
      ticker: Number(i.total ?? i.quantidade_real ?? 0),
      type: 'TICKET',
    }));

    const projections: TicketProjectionItemDto[] = projectedSeries.map((p) => ({
      date: p.data,
      ticker: Number(p.quantidade_projetada ?? 0),
      type: 'PROJECTION',
    }));

    const response: TicketReportResponseDto = {
      data,
      variacao,
      serie: [...historicalSeries, ...projectedSeries],
      metadados,
      tickets,
      projections,
    };

    // cache por 5 minutos
    await this.cache.set(cacheKey, response, 300_000);
    return response;
  }

  async listTickets(
    query: ListTicketsQueryDto,
  ): Promise<PaginationResponse<TicketResponseDto>> {
    const pageParam = Number(query.page);
    const limitParam = Number(query.limit);

    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const take = Math.min(
      100,
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50,
    );
    const skip = (page - 1) * take;

    const where: any = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // Date range filtering on createdAt
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        const start = new Date(query.startDate);
        if (!isNaN(start.getTime())) (where.createdAt as any).gte = start;
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        if (!isNaN(end.getTime())) (where.createdAt as any).lte = end;
      }
    }

    const sortBy = (
      query.sortBy === 'updatedAt' ? 'updatedAt' : 'createdAt'
    ) as 'createdAt' | 'updatedAt';
    const sortOrder = (query.sortOrder === 'asc' ? 'asc' : 'desc') as
      | 'asc'
      | 'desc';

    const [items, totalItems] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        orderBy: { [sortBy]: sortOrder } as any,
        skip,
        take,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    const pagination: PaginationInfo = {
      totalItems,
      pageSize: take,
      pageNumber: page,
      totalPages: Math.ceil(totalItems / take) || 1,
      previousPage: page > 1 ? page - 1 : 0,
      nextPage: skip + take < totalItems ? page + 1 : 0,
      lastPage: Math.ceil(totalItems / take) || 1,
      hasPreviousPage: page > 1,
      hasNextPage: skip + take < totalItems,
    };

    const mapped: TicketResponseDto[] = items.map((t) => ({
      id: t.id,
      userId: t.userId,
      title: t.title,
      description: t.description,
      category: t.category,
      priority: t.priority,
      status: t.status,
      resolution: (t as any).resolution,
      attachments: t.attachments,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return new PaginationResponse<TicketResponseDto>(mapped, pagination);
  }

  // ===== Dashboard: Overview =====
  async getDashboardOverview(): Promise<DashboardOverviewResponseDto> {
    const [openCount, inProgressCount, closedCount] = await Promise.all([
      this.prisma.ticket.count({
        where: { status: { in: this.OPEN_STATUSES as $Enums.TicketStatus[] } },
      }),
      this.prisma.ticket.count({
        where: {
          status: { in: this.IN_PROGRESS_STATUSES as $Enums.TicketStatus[] },
        },
      }),
      this.prisma.ticket.count({
        where: {
          status: { in: this.CLOSED_STATUSES as $Enums.TicketStatus[] },
        },
      }),
    ]);

    // SLA em risco: tickets não fechados cujo tempo >= limite da prioridade
    const openTickets = await this.prisma.ticket.findMany({
      where: {
        NOT: { status: { in: this.CLOSED_STATUSES as $Enums.TicketStatus[] } },
      },
      select: { id: true, priority: true, createdAt: true },
    });

    const now = new Date().getTime();
    const slaRisk = openTickets.filter((t) => {
      const prio = this.normalizePriority(t.priority);
      const threshold = this.SLA_THRESHOLDS_HOURS[prio] * 3600_000;
      const ageMs = now - new Date(t.createdAt).getTime();
      return ageMs >= threshold;
    }).length;

    const critical = openTickets.filter(
      (t) => this.normalizePriority(t.priority) === 'CRITICAL',
    ).length;

    return {
      open: openCount,
      inProgress: inProgressCount,
      closed: closedCount,
      slaRisk,
      critical,
    };
  }

  // ===== Dashboard: Indicators =====
  async getDashboardIndicators(): Promise<DashboardIndicatorsResponseDto> {
    const [total, resolvedTickets] = await Promise.all([
      this.prisma.ticket.count(),
      this.prisma.ticket.findMany({
        where: {
          status: { in: this.CLOSED_STATUSES as $Enums.TicketStatus[] },
        },
        select: { createdAt: true, updatedAt: true },
      }),
    ]);

    const resolutionRatePercent =
      total > 0
        ? Number(((resolvedTickets.length / total) * 100).toFixed(2))
        : 0;

    // Tempo médio até resolução: (updatedAt - createdAt) em horas, apenas resolvidos
    const avgMs =
      resolvedTickets.reduce(
        (acc, t) =>
          acc +
          (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()),
        0,
      ) / (resolvedTickets.length || 1);
    const averageResolutionTimeHours =
      resolvedTickets.length > 0 ? Number((avgMs / 3600_000).toFixed(2)) : 0;

    return { resolutionRatePercent, averageResolutionTimeHours };
  }

  // ===== Dashboard: Priority Distribution =====
  async getPriorityDistribution(): Promise<PriorityDistributionResponseDto> {
    const all = await this.prisma.ticket.findMany({
      select: { priority: true },
    });
    const dist = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const t of all) {
      const prio = this.normalizePriority(t.priority);
      if (prio === 'LOW') dist.low++;
      else if (prio === 'MEDIUM') dist.medium++;
      else if (prio === 'HIGH') dist.high++;
      else if (prio === 'CRITICAL') dist.critical++;
    }
    return {
      low: dist.low,
      medium: dist.medium,
      high: dist.high,
      critical: dist.critical,
    };
  }

  private normalizePriority(
    value: string | null | undefined,
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (!value) return 'LOW';
    const key = String(value).toLowerCase();
    const mapped = this.PRIORITY_MAP[key as keyof typeof this.PRIORITY_MAP];
    return mapped ?? 'LOW';
  }

  private normalizeCategory(
    value: string | null | undefined,
  ): $Enums.TicketCategory {
    if (!value) return 'OTHER';
    const raw = String(value).trim().toLowerCase();
    const key = raw.replace(/\s+/g, '_');
    const map: Record<string, $Enums.TicketCategory> = {
      payments: 'PAYMENTS',
      payment: 'PAYMENTS',
      account: 'ACCOUNT',
      accounts: 'ACCOUNT',
      bugs: 'BUGS',
      bug: 'BUGS',
      access: 'ACCESS',
      tech_support: 'TECH_SUPPORT',
      support: 'TECH_SUPPORT',
      technical_support: 'TECH_SUPPORT',
      subscription: 'SUBSCRIPTION',
      subscriptions: 'SUBSCRIPTION',
      registration: 'REGISTRATION',
      signup: 'REGISTRATION',
      login: 'LOGIN',
      performance: 'PERFORMANCE',
      other: 'OTHER',
      general: 'OTHER',
      misc: 'OTHER',
      others: 'OTHER',
    };
    return map[key] ?? 'OTHER';
  }

  // ===== Dashboard: SLA Alerts list =====
  async listSlaAlerts(query: SlaAlertsQueryDto): Promise<SlaAlertItemDto[]> {
    const where: any = {
      NOT: { status: { in: this.CLOSED_STATUSES as $Enums.TicketStatus[] } },
    };
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const items = await this.prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        createdAt: true,
      },
    });

    const severityFilter = (query.severity || '').toUpperCase();
    const nowMs = Date.now();

    const result: SlaAlertItemDto[] = items
      .map((t) => {
        const prio = this.normalizePriority(t.priority);
        const ageHours = (nowMs - new Date(t.createdAt).getTime()) / 3600_000;
        const thresholdHours = this.SLA_THRESHOLDS_HOURS[prio];
        const breached = ageHours >= thresholdHours;
        return {
          id: t.id,
          title: t.title,
          priority: prio,
          status: t.status,
          createdAt: t.createdAt,
          ageHours: Number(ageHours.toFixed(2)),
          thresholdHours,
          breached,
        } as SlaAlertItemDto;
      })
      .filter((i) => i.breached)
      .filter((i) => (severityFilter ? i.priority === severityFilter : true));

    return result;
  }

  // ===== Audit metrics: Top error endpoints =====
  async getTopErrorEndpoints(query: {
    limit?: number;
    from?: string;
    to?: string;
  }): Promise<ErrorEndpointCountDto[]> {
    const limit =
      Number.isFinite(Number(query.limit)) && Number(query.limit) > 0
        ? Math.min(50, Number(query.limit))
        : 10;
    const where: any = {
      OR: [{ level: 'ERROR' }, { statusCode: { gte: 400 } }],
    };
    if (query.from || query.to) {
      where.requestedAt = {};
      if (query.from) where.requestedAt.gte = new Date(query.from);
      if (query.to) where.requestedAt.lte = new Date(query.to);
    }

    const grouped = await (this.prisma as any).helpdeskAuditLog.groupBy({
      by: ['endpoint'],
      where,
      _count: { _all: true },
    });

    const result: ErrorEndpointCountDto[] = grouped
      .map((r: any) => ({
        endpoint: r.endpoint,
        total: Number(r._count?._all || 0),
      }))
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, limit);

    return result;
  }

  // ===== Audit metrics: Recent error endpoints =====
  async getRecentErrorEndpoints(query: {
    hours?: number;
    limit?: number;
  }): Promise<ErrorEndpointRecentDto[]> {
    const hours =
      Number.isFinite(Number(query.hours)) && Number(query.hours) > 0
        ? Number(query.hours)
        : 24;
    const limit =
      Number.isFinite(Number(query.limit)) && Number(query.limit) > 0
        ? Math.min(50, Number(query.limit))
        : 10;
    const since = new Date(Date.now() - hours * 3600_000);

    const where: any = {
      requestedAt: { gte: since },
      OR: [{ level: 'ERROR' }, { statusCode: { gte: 400 } }],
    };

    const grouped = await (this.prisma as any).helpdeskAuditLog.groupBy({
      by: ['endpoint'],
      where,
      _count: { _all: true },
      _max: { requestedAt: true },
    });

    const result: ErrorEndpointRecentDto[] = grouped
      .map((r: any) => ({
        endpoint: r.endpoint,
        total: Number(r._count?._all || 0),
        lastErrorAt: r._max?.requestedAt,
      }))
      .sort(
        (a: any, b: any) =>
          new Date(b.lastErrorAt).getTime() - new Date(a.lastErrorAt).getTime(),
      )
      .slice(0, limit);

    return result;
  }

  async createTicket(
    payload: CreateTicketRequestDto,
    userId: string,
    attachments?: any,
  ): Promise<TicketResponseDto> {
    const created = await this.prisma.ticket.create({
      data: {
        userId,
        title: payload.title,
        description: payload.description,
        category: this.normalizeCategory(payload.category),
        priority: 'LOW',
        status: 'OPEN',
        attachments: attachments ? attachments : undefined,
      },
    });

    // Audit change for creation
    await this.audit.logChange({
      action: 'CREATE_TICKET',
      entity: 'Ticket',
      userId,
      before: null,
      after: {
        id: created.id,
        userId: created.userId,
        title: created.title,
        description: created.description,
        category: created.category,
        priority: created.priority,
        status: created.status,
      },
      level: 'INFO',
    });

    return {
      id: created.id,
      userId: created.userId,
      title: created.title,
      description: created.description,
      category: created.category,
      priority: created.priority,
      status: created.status,
      resolution: (created as any).resolution,
      attachments: created.attachments,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async getTicketById(
    id: string,
    requester: { id: string; profile?: string },
  ): Promise<TicketResponseDto> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket não encontrado');

    const isAdmin = requester.profile === 'ADMIN';
    const isOwner = ticket.userId === requester.id;
    if (!isAdmin && !isOwner)
      throw new ForbiddenException('Acesso negado ao ticket');

    return {
      id: ticket.id,
      userId: ticket.userId,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      resolution: (ticket as any).resolution,
      attachments: ticket.attachments,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }

  async listTicketComments(
    ticketId: string,
    requester: { id: string; profile?: string },
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('Ticket não encontrado');

    const isAdmin = requester.profile === 'ADMIN';
    const isOwner = ticket.userId === requester.id;
    if (!isAdmin && !isOwner)
      throw new ForbiddenException('Acesso negado aos comentários');

    const where: any = { ticketId };
    if (!isAdmin) where.isInternal = false;

    const comments = await (this.prisma as any).ticketComment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            profile: true,
            avatar: true,
          },
        },
      },
    });

    return comments.map((c) => ({
      id: c.id,
      ticketId: c.ticketId,
      userName: [c.user?.firstName, c.user?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim(),
      profile: c.user?.profile,
      avatar: c.user?.avatar,
      content: c.content,
      attachments: (c as any).attachments,
      createdAt: c.createdAt,
    }));
  }

  async addTicketComment(
    ticketId: string,
    requester: { id: string; profile?: string },
    content: string,
    attachments?: any[],
    isInternal?: boolean,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('Ticket não encontrado');

    const isAdmin = requester.profile === 'ADMIN';
    const isOwner = ticket.userId === requester.id;
    if (!isAdmin && !isOwner)
      throw new ForbiddenException('Acesso negado ao ticket');

    const trimmed = (content || '').trim();
    if (!trimmed)
      throw new BadRequestException('Mensagem do comentário é obrigatória');

    const created = await (this.prisma as any).ticketComment.create({
      data: {
        ticketId,
        userId: requester.id,
        content: trimmed,
        isInternal: isInternal && requester.profile === 'ADMIN' ? true : false,
        attachments:
          attachments && Array.isArray(attachments) ? attachments : undefined,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            profile: true,
            avatar: true,
          },
        },
      },
    });

    await this.audit.logChange({
      action: 'ADD_TICKET_COMMENT',
      entity: 'TicketComment',
      userId: requester.id,
      accessLevel: requester.profile,
      before: null,
      after: {
        id: created.id,
        ticketId: created.ticketId,
        userId: requester.id,
        content: created.content,
        isInternal: created.isInternal,
      },
      level: 'INFO',
    });

    return {
      id: created.id,
      ticketId: created.ticketId,
      userName: [created.user?.firstName, created.user?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim(),
      profile: created.user?.profile,
      avatar: created.user?.avatar,
      content: created.content,
      attachments: created.attachments,
      createdAt: created.createdAt,
    };
  }

  async updateTicket(
    id: string,
    requester: { id: string; profile?: string },
    payload: { status?: string; priority?: string; resolution?: string },
  ): Promise<TicketResponseDto> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket não encontrado');

    const isAdmin = requester.profile === 'ADMIN';
    const isOwner = ticket.userId === requester.id;
    if (!isAdmin && !isOwner)
      throw new ForbiddenException('Acesso negado ao ticket');

    const data: any = {};
    if (typeof payload.status === 'string') data.status = payload.status;
    if (typeof payload.priority === 'string') data.priority = payload.priority;
    if (typeof payload.resolution === 'string')
      data.resolution = payload.resolution;

    if (data.status === 'RESOLVED') {
      const finalResolution = data.resolution ?? (ticket as any).resolution;
      if (!finalResolution) {
        throw new BadRequestException(
          'Resolution é obrigatória quando status=RESOLVED',
        );
      }
    }

    const updated = await this.prisma.ticket.update({ where: { id }, data });

    await this.audit.logChange({
      action: 'UPDATE_TICKET',
      entity: 'Ticket',
      userId: requester.id,
      accessLevel: requester.profile,
      before: {
        id: ticket.id,
        status: ticket.status,
        priority: ticket.priority,
        resolution: (ticket as any).resolution,
      },
      after: {
        id: updated.id,
        status: updated.status,
        priority: updated.priority,
        resolution: (updated as any).resolution,
      },
      level: 'INFO',
    });
    return {
      id: updated.id,
      userId: updated.userId,
      title: updated.title,
      description: updated.description,
      category: updated.category,
      priority: updated.priority,
      status: updated.status,
      resolution: (updated as any).resolution,
      attachments: updated.attachments,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}