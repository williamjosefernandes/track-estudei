import {
  Controller,
  Post,
  HttpCode,
  Logger,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { MetricsService } from './metrics.service';
import {
  startOfWeek,
  subWeeks,
  startOfMonth,
  subMonths,
  parse,
  isValid,
} from 'date-fns';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);
  constructor(private readonly metricsService: MetricsService) {}

  // Helper to format number as Brazilian Real currency string
  private formatCurrency(value?: number | null) {
    const n = typeof value === 'number' ? value : Number(value ?? 0);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(n);
  }

  // Helper to format plain numbers in Brazilian format (e.g. 1.234 or 1.234,56)
  private formatNumber(value?: number | null) {
    const n = typeof value === 'number' ? value : Number(value ?? 0);
    // Use maximumFractionDigits = 2 to preserve small fractional values if present
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  }

  @Post('collect')
  @HttpCode(202)
  async collect() {
    this.logger.log('Manual trigger for estudei metrics collection');
    this.metricsService.collect('manual').catch((e) => {
      this.logger.error('Manual collection failed', e as any);
    });
    return { status: 'queued' };
  }

  // Helper: validate ISO date strings and ordering
  /**
   * Parse date param which may be in dd/MM/yyyy or ISO format.
   * Returns ISO string or undefined.
   */
  private parseDateParam(dateStr?: string): string | undefined {
    if (!dateStr) return undefined;
    const ddmmyyyy = /^\d{2}\/\d{2}\/\d{4}$/;
    if (ddmmyyyy.test(dateStr)) {
      const d = parse(dateStr, 'dd/MM/yyyy', new Date());
      if (!isValid(d)) {
        throw new BadRequestException(
          'Invalid date. Expected format dd/MM/yyyy',
        );
      }
      return d.toISOString();
    }
    // try ISO
    const iso = new Date(dateStr);
    if (isNaN(iso.getTime())) {
      throw new BadRequestException(
        'Invalid date. Expected dd/MM/yyyy or ISO string',
      );
    }
    return iso.toISOString();
  }

  private validateDatesOrderIso(startIso?: string, endIso?: string) {
    if (startIso && endIso) {
      const s = new Date(startIso);
      const e = new Date(endIso);
      if (s.getTime() > e.getTime()) {
        throw new BadRequestException('start must be before or equal to end');
      }
    }
  }

  /**
   * Daily aggregation: new students per day within optional start/end
   */
  @Get('students/daily')
  @ApiOperation({ summary: 'Daily new students aggregation' })
  @ApiQuery({
    name: 'start',
    required: false,
    description: 'Start date (dd/MM/yyyy or ISO) inclusive',
  })
  @ApiQuery({
    name: 'end',
    required: false,
    description: 'End date (dd/MM/yyyy or ISO) inclusive',
  })
  @ApiOkResponse({
    description: 'Daily aggregation result',
    schema: {
      example: {
        data: [
          { period: '2025-12-01', newStudents: 10, totalStudents: 100 },
          { period: '2025-12-02', newStudents: 5, totalStudents: 105 },
        ],
      },
    },
  })
  async getStudentsDaily(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const isoStart = this.parseDateParam(start);
    const isoEnd = this.parseDateParam(end);
    this.validateDatesOrderIso(isoStart, isoEnd);
    this.logger.log(`students/daily start=${start} end=${end}`);
    const raw = await this.metricsService.getAggregatedMetrics({
      groupBy: 'day',
      start: isoStart,
      end: isoEnd,
    });

    const data = raw.map((r) => {
      const studentsDelta = Number(r.studentsDeltaBucket) || 0;
      // studentsDelta = latest.students - earliest.students
      const valorNovosUsuariosRaw = studentsDelta * 28.4;
      return {
        period: r.period,
        // Use bucket delta (latest - earliest) for novosUsuarios as requested
        novosUsuarios: this.formatNumber(studentsDelta),
        usuariosTotais: this.formatNumber(r.total.students),

        novosPlanos: this.formatNumber(r.new.plans),
        planosTotais: this.formatNumber(r.total.plans),

        novosTopicos: this.formatNumber(r.new.topics),
        topicosTotais: this.formatNumber(r.total.topics),

        novosAssuntos: this.formatNumber(r.new.subjects),
        assuntosTotais: this.formatNumber(r.total.subjects),

        novosPlanejamentos: this.formatNumber(r.new.plannings),
        planejamentosTotais: this.formatNumber(r.total.plannings),

        novosEstudos: this.formatNumber(r.new.studies),
        estudosTotais: this.formatNumber(r.total.studies),

        novosDuracaoSemana: this.formatNumber(r.new.durationStudiesWeek),
        duracaoSemanaTotais: this.formatNumber(r.total.durationStudiesWeek),

        // Monetary value for new users only: (primeiro - último) * 28.40
        // service returns studiesDeltaBucket = latest - earliest
        valorNovosUsuarios: this.formatCurrency(valorNovosUsuariosRaw),

        valorNovo: this.formatCurrency(r.new.value),
        valorTotal: this.formatCurrency(r.total.value),
      };
    });

    return { data };
  }

  /**
   * Weekly aggregation: new students per week within optional start/end
   */
  @ApiOperation({ summary: 'Weekly new students aggregation' })
  @ApiQuery({
    name: 'start',
    required: false,
    description:
      'Start date (dd/MM/yyyy or ISO). If omitted defaults to 8 weeks ago.',
  })
  @ApiQuery({
    name: 'end',
    required: false,
    description: 'End date (dd/MM/yyyy or ISO). If omitted defaults to now.',
  })
  @ApiOkResponse({
    description: 'Weekly aggregation result',
    schema: {
      example: {
        data: [
          { period: '2025-11-24', newStudents: 20, totalStudents: 200 },
          { period: '2025-12-01', newStudents: 15, totalStudents: 215 },
        ],
      },
    },
  })
  @Get('students/weekly')
  async getStudentsWeekly(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    // if no params provided, default to last 8 weeks (aligned to week start)
    const now = new Date();
    const computedStart = start
      ? this.parseDateParam(start)
      : startOfWeek(subWeeks(now, 8), { weekStartsOn: 1 }).toISOString();
    const computedEnd = end ? this.parseDateParam(end) : now.toISOString();

    this.validateDatesOrderIso(computedStart, computedEnd);
    this.logger.log(
      `students/weekly start=${computedStart} end=${computedEnd}`,
    );
    const raw = await this.metricsService.getAggregatedMetrics({
      groupBy: 'week',
      start: computedStart,
      end: computedEnd,
    });

    const data = raw.map((r) => {
      const studentsDelta = Number(r.studentsDeltaBucket) || 0;
      const valorNovosUsuariosRaw = studentsDelta * 28.4;
      return {
        period: r.period,
        novosUsuarios: this.formatNumber(studentsDelta),
        usuariosTotais: this.formatNumber(r.total.students),
        novosPlanos: this.formatNumber(r.new.plans),
        planosTotais: this.formatNumber(r.total.plans),
        novosTopicos: this.formatNumber(r.new.topics),
        topicosTotais: this.formatNumber(r.total.topics),
        novosAssuntos: this.formatNumber(r.new.subjects),
        assuntosTotais: this.formatNumber(r.total.subjects),
        novosPlanejamentos: this.formatNumber(r.new.plannings),
        planejamentosTotais: this.formatNumber(r.total.plannings),
        novosEstudos: this.formatNumber(r.new.studies),
        estudosTotais: this.formatNumber(r.total.studies),
        novosDuracaoSemana: this.formatNumber(r.new.durationStudiesWeek),
        duracaoSemanaTotais: this.formatNumber(r.total.durationStudiesWeek),
        // Monetary value for new users only: (primeiro - último) * 28.40
        valorNovosUsuarios: this.formatCurrency(valorNovosUsuariosRaw),
        valorNovo: this.formatCurrency(r.new.value),
        valorTotal: this.formatCurrency(r.total.value),
      };
    });

    return { data };
  }

  /**
   * Monthly aggregation: new students per month within optional start/end
   */
  @ApiOperation({ summary: 'Monthly new students aggregation' })
  @ApiQuery({
    name: 'start',
    required: false,
    description:
      'Start date (dd/MM/yyyy or ISO). If omitted defaults to 12 months ago.',
  })
  @ApiQuery({
    name: 'end',
    required: false,
    description: 'End date (dd/MM/yyyy or ISO). If omitted defaults to now.',
  })
  @ApiOkResponse({
    description: 'Monthly aggregation result',
    schema: {
      example: {
        data: [
          { period: '2024-12', newStudents: 120, totalStudents: 1200 },
          { period: '2025-01', newStudents: 80, totalStudents: 1280 },
        ],
      },
    },
  })
  @Get('students/monthly')
  async getStudentsMonthly(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    // if no params provided, default to last 12 months (aligned to month start)
    const now = new Date();
    const computedStart = start
      ? this.parseDateParam(start)
      : startOfMonth(subMonths(now, 12)).toISOString();
    const computedEnd = end ? this.parseDateParam(end) : now.toISOString();

    this.validateDatesOrderIso(computedStart, computedEnd);
    this.logger.log(
      `students/monthly start=${computedStart} end=${computedEnd}`,
    );
    const raw = await this.metricsService.getAggregatedMetrics({
      groupBy: 'month',
      start: computedStart,
      end: computedEnd,
    });

    const data = raw.map((r) => {
      const studentsDelta = Number(r.studentsDeltaBucket) || 0;
      const valorNovosUsuariosRaw = studentsDelta * 28.4;
      return {
        period: r.period,
        novosUsuarios: this.formatNumber(studentsDelta),
        usuariosTotais: this.formatNumber(r.total.students),
        novosPlanos: this.formatNumber(r.new.plans),
        planosTotais: this.formatNumber(r.total.plans),
        novosTopicos: this.formatNumber(r.new.topics),
        topicosTotais: this.formatNumber(r.total.topics),
        novosAssuntos: this.formatNumber(r.new.subjects),
        assuntosTotais: this.formatNumber(r.total.subjects),
        novosPlanejamentos: this.formatNumber(r.new.plannings),
        planejamentosTotais: this.formatNumber(r.total.plannings),
        novosEstudos: this.formatNumber(r.new.studies),
        estudosTotais: this.formatNumber(r.total.studies),
        novosDuracaoSemana: this.formatNumber(r.new.durationStudiesWeek),
        duracaoSemanaTotais: this.formatNumber(r.total.durationStudiesWeek),
        // Monetary value for new users only: (primeiro - último) * 28.40
        valorNovosUsuarios: this.formatCurrency(valorNovosUsuariosRaw),
        valorNovo: this.formatCurrency(r.new.value),
        valorTotal: this.formatCurrency(r.total.value),
      };
    });

    return { data };
  }

  /**
   * Generic range endpoint: accepts groupBy=day|week|month and start/end
   */
  @Get('students')
  async getStudents(
    @Query('groupBy') groupByRaw?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    // validate groupBy
    const allowed = ['day', 'week', 'month'];
    const groupBy = allowed.includes(groupByRaw ?? '')
      ? (groupByRaw as 'day' | 'week' | 'month')
      : 'day';

    const isoStart = this.parseDateParam(start);
    const isoEnd = this.parseDateParam(end);
    this.validateDatesOrderIso(isoStart, isoEnd);

    this.logger.log(
      `Requesting students aggregation groupBy=${groupBy} start=${start} end=${end}`,
    );

    const raw = await this.metricsService.getAggregatedMetrics({
      groupBy,
      start: isoStart,
      end: isoEnd,
    });

    const data = raw.map((r) => {
      const studentsDelta = Number(r.studentsDeltaBucket) || 0;
      const valorNovosUsuariosRaw = studentsDelta * 28.4;
      return {
        period: r.period,
        novosUsuarios: this.formatNumber(studentsDelta),
        usuariosTotais: this.formatNumber(r.total.students),
        novosPlanos: this.formatNumber(r.new.plans),
        planosTotais: this.formatNumber(r.total.plans),
        novosTopicos: this.formatNumber(r.new.topics),
        topicosTotais: this.formatNumber(r.total.topics),
        novosAssuntos: this.formatNumber(r.new.subjects),
        assuntosTotais: this.formatNumber(r.total.subjects),
        novosPlanejamentos: this.formatNumber(r.new.plannings),
        planejamentosTotais: this.formatNumber(r.total.plannings),
        novosEstudos: this.formatNumber(r.new.studies),
        estudosTotais: this.formatNumber(r.total.studies),
        novosDuracaoSemana: this.formatNumber(r.new.durationStudiesWeek),
        duracaoSemanaTotais: this.formatNumber(r.total.durationStudiesWeek),
        // Monetary value for new users only: (primeiro - último) * 28.40
        valorNovosUsuarios: this.formatCurrency(valorNovosUsuariosRaw),
        valorNovo: this.formatCurrency(r.new.value),
        valorTotal: this.formatCurrency(r.total.value),
      };
    });

    return { data };
  }
}
