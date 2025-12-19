import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  format,
  parseISO,
} from 'date-fns';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly http: AxiosInstance;
  private readonly tokenCacheKey = 'estudei:authToken';

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    this.http = axios.create({
      baseURL: process.env.ESTUDEI_API_BASE_URL ?? 'https://api.estudei.com.br',
      timeout: 10000,
    });
  }

  async collect(source = 'scheduler') {
    this.logger.log(`Collecting estudei metrics (trigger=${source})`);

    try {
      const token = await this.getAuthToken();
      const result = await this.doGetStatistics(token);

      // parse numeric fields and compute students
      const plans = Number(result?.plans ?? 0);
      const topics = Number(result?.topics ?? 0);
      const subjects = Number(result?.subjects ?? 0);
      const plannings = Number(result?.plannings ?? 0);
      const studies = Number(result?.studies ?? 0);
      const durationStudiesWeekRaw = result?.durationStudiesWeek ?? null;
      const durationStudiesWeek =
        durationStudiesWeekRaw != null
          ? BigInt(String(durationStudiesWeekRaw))
          : null;

      // assumption: cada student pode ter até 3 plans -> estimativa de students
      const students = Math.ceil(plans / 3);

      // calculate monetary value: students * 28.40 (store as string with 2 decimals)
      const unitPrice = 28.4;
      const valueNumber = Number((students * unitPrice).toFixed(2));
      const valueStr = valueNumber.toFixed(2);

      await this.prisma.estudeiMetric.create({
        data: {
          fetchedAt: new Date(),
          plans: plans || null,
          topics: topics || null,
          subjects: subjects || null,
          plannings: plannings || null,
          studies: studies || null,
          durationStudiesWeek: durationStudiesWeek ?? null,
          students: students || null,
          value: valueStr || null,
        },
      } as any);

      this.logger.log('Estudei metrics saved');
      return result;
    } catch (e) {
      this.logger.error('Error collecting estudei metrics', e as any);
      throw e;
    }
  }

  private async getAuthToken(): Promise<string> {
    const cached = await this.cache.get<{ token: string; expiresAt: string }>(
      this.tokenCacheKey,
    );

    if (cached && cached.token) {
      return cached.token;
    }

    return this.authenticate();
  }

  private async authenticate(): Promise<string> {
    this.logger.log('Authenticating to estudei API to obtain token');

    const authEmail = 'williamjosefernandes@gmail.com';
    const authPassword = '&jfw130291';

    if (!authEmail || !authPassword) {
      throw new Error(
        'ESTUDEI_AUTH_EMAIL and ESTUDEI_AUTH_PASSWORD must be set',
      );
    }

    const payload = {
      email: authEmail,
      password: authPassword,
    } as any;

    const response = await this.withRetry(() =>
      this.http.post('/users/login', payload),
    );

    const token = (response as any).data?.token;

    if (!token) {
      throw new Error('Authentication did not return a token');
    }

    // store token in cache with a conservative TTL (1 hour) unless API returns expiry info
    const ttl = 60 * 60; // seconds
    await this.cache.set(
      this.tokenCacheKey,
      { token, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() },
      ttl,
    );

    return token;
  }

  private async doGetStatistics(token: string) {
    try {
      const res = await this.withRetry(() =>
        this.http.get('/public/statistics', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      return (res as any).data;
    } catch (err: any) {
      // If 401, try to re-auth once
      const status = err?.response?.status;

      if (status === 401) {
        this.logger.warn(
          'Received 401 from estudei API; attempting to re-authenticate and retry once',
        );

        await this.cache.del(this.tokenCacheKey);
        const newToken = await this.authenticate();
        const retryRes = await this.http.get('/public/statistics', {
          headers: { Authorization: `Bearer ${newToken}` },
        });

        return retryRes.data;
      }

      throw err;
    }
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    retries = 3,
    baseDelayMs = 1000,
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await fn();
      } catch (e) {
        attempt++;
        if (attempt > retries) throw e;

        const delay =
          baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 100);

        this.logger.warn(
          `Attempt ${attempt} failed, retrying after ${delay}ms: ${(e as any).message}`,
        );

        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  // New method: aggregate new students per period
  async getNewStudentsAggregation(options: {
    groupBy: 'day' | 'week' | 'month';
    start?: string; // ISO date
    end?: string; // ISO date
  }) {
    const { groupBy, start, end } = options;
    const endDate = end ? parseISO(end) : new Date();
    const startDate = start
      ? parseISO(start)
      : new Date(Date.now() - 1000 * 60 * 60 * 24 * 30); // default 30 days

    if (startDate > endDate) {
      throw new Error('start must be before end');
    }

    // fetch metrics from one period before start to end to compute deltas
    // for safety, subtract one extra day
    const prefetchDate = new Date(
      startDate.getTime() - 1000 * 60 * 60 * 24 * 2,
    );

    const metrics = await this.prisma.estudeiMetric.findMany({
      where: {
        fetchedAt: {
          gte: prefetchDate,
          lte: endDate,
        },
      },
      orderBy: { fetchedAt: 'asc' },
    });

    if (!metrics || metrics.length === 0) {
      // no data -> return empty array
      return [];
    }

    // group by bucket key
    const buckets: Record<string, { date: Date; metric: any }[]> = {};

    for (const m of metrics) {
      const ts = m.fetchedAt as Date;
      let key = '';

      if (groupBy === 'day') {
        key = format(startOfDay(ts), 'yyyy-MM-dd');
      } else if (groupBy === 'week') {
        const wkStart = startOfWeek(ts, { weekStartsOn: 1 });
        key = format(wkStart, 'yyyy-LL-dd');
      } else {
        const monthStart = startOfMonth(ts);
        key = format(monthStart, 'yyyy-LL');
      }

      buckets[key] = buckets[key] || [];
      buckets[key].push({ date: ts, metric: m });
    }

    // For each bucket take the last metric in that bucket
    const sortedKeys = Object.keys(buckets).sort();

    const results: Array<{
      period: string;
      newStudents: number;
      totalStudents: number;
    }> = [];

    let previousStudents = 0;
    // find latest metric before startDate to set initial previousStudents
    const beforeStart = metrics
      .filter((m) => (m.fetchedAt as Date) < startDate)
      .pop();
    if (beforeStart && beforeStart.students != null) {
      previousStudents = Number(beforeStart.students);
    }

    for (const key of sortedKeys) {
      // pick latest metric by date
      const items = buckets[key];
      items.sort((a, b) => a.date.getTime() - b.date.getTime());
      const latest = items[items.length - 1].metric;
      const totalStudents = Number(latest.students ?? 0);
      const newStudents = Math.max(0, totalStudents - previousStudents);
      results.push({ period: key, newStudents, totalStudents });
      previousStudents = totalStudents;
    }

    return results;
  }

  // New method: aggregate multiple metrics per period (totals and new/delta)
  async getAggregatedMetrics(options: {
    groupBy: 'day' | 'week' | 'month';
    start?: string; // ISO date
    end?: string; // ISO date
  }) {
    const { groupBy, start, end } = options;
    const endDate = end ? parseISO(end) : new Date();
    const startDate = start
      ? parseISO(start)
      : new Date(Date.now() - 1000 * 60 * 60 * 24 * 30); // default 30 days

    if (startDate > endDate) {
      throw new Error('start must be before end');
    }

    const prefetchDate = new Date(
      startDate.getTime() - 1000 * 60 * 60 * 24 * 2,
    );

    const metrics = await this.prisma.estudeiMetric.findMany({
      where: {
        fetchedAt: {
          gte: prefetchDate,
          lte: endDate,
        },
      },
      orderBy: { fetchedAt: 'asc' },
    });

    if (!metrics || metrics.length === 0) return [];

    const buckets: Record<string, { date: Date; metric: any }[]> = {};

    for (const m of metrics) {
      const ts = m.fetchedAt as Date;
      let key = '';
      if (groupBy === 'day') {
        key = format(startOfDay(ts), 'yyyy-MM-dd');
      } else if (groupBy === 'week') {
        const wkStart = startOfWeek(ts, { weekStartsOn: 1 });
        key = format(wkStart, 'yyyy-LL-dd');
      } else {
        const monthStart = startOfMonth(ts);
        key = format(monthStart, 'yyyy-LL');
      }
      buckets[key] = buckets[key] || [];
      buckets[key].push({ date: ts, metric: m });
    }

    const sortedKeys = Object.keys(buckets).sort();

    const results: Array<any> = [];

    // get latest metric before startDate to serve as previous baseline
    const beforeStart = metrics
      .filter((m) => (m.fetchedAt as Date) < startDate)
      .pop();

    const toNumber = (v: any) => {
      if (v == null) return 0;
      const n = Number(v);
      return Number.isNaN(n) ? 0 : n;
    };

    let previous = {
      students:
        beforeStart && beforeStart.students != null
          ? toNumber(beforeStart.students)
          : 0,
      plans:
        beforeStart && beforeStart.plans != null
          ? toNumber(beforeStart.plans)
          : 0,
      topics:
        beforeStart && beforeStart.topics != null
          ? toNumber(beforeStart.topics)
          : 0,
      subjects:
        beforeStart && beforeStart.subjects != null
          ? toNumber(beforeStart.subjects)
          : 0,
      plannings:
        beforeStart && beforeStart.plannings != null
          ? toNumber(beforeStart.plannings)
          : 0,
      studies:
        beforeStart && beforeStart.studies != null
          ? toNumber(beforeStart.studies)
          : 0,
      durationStudiesWeek:
        beforeStart && beforeStart.durationStudiesWeek != null
          ? Number(beforeStart.durationStudiesWeek)
          : 0,
      value:
        beforeStart && (beforeStart as any).value != null
          ? Number(String((beforeStart as any).value))
          : 0,
    };

    for (const key of sortedKeys) {
      const items = buckets[key];
      items.sort((a, b) => a.date.getTime() - b.date.getTime());
      const latest = items[items.length - 1].metric;
      const earliest = items[0].metric;

      const total = {
        students: toNumber(latest.students),
        plans: toNumber(latest.plans),
        topics: toNumber(latest.topics),
        subjects: toNumber(latest.subjects),
        plannings: toNumber(latest.plannings),
        studies: toNumber(latest.studies),
        durationStudiesWeek:
          latest.durationStudiesWeek != null
            ? Number(latest.durationStudiesWeek)
            : 0,
        value:
          (latest as any).value != null
            ? Number(String((latest as any).value))
            : 0,
      };

      // difference of students inside the bucket (latest - earliest)
      const studentsDeltaBucket = toNumber(latest.students) - toNumber(earliest.students);

      const delta = {
        students: Math.max(0, total.students - previous.students),
        plans: Math.max(0, total.plans - previous.plans),
        topics: Math.max(0, total.topics - previous.topics),
        subjects: Math.max(0, total.subjects - previous.subjects),
        plannings: Math.max(0, total.plannings - previous.plannings),
        studies: Math.max(0, total.studies - previous.studies),
        durationStudiesWeek: Math.max(
          0,
          total.durationStudiesWeek - previous.durationStudiesWeek,
        ),
        value: Math.max(0, Number((total.value - previous.value).toFixed(2))),
      };

      results.push({ period: key, total, new: delta, studentsDeltaBucket });

      previous = {
        students: total.students,
        plans: total.plans,
        topics: total.topics,
        subjects: total.subjects,
        plannings: total.plannings,
        studies: total.studies,
        durationStudiesWeek: total.durationStudiesWeek,
        value: total.value,
      };
    }

    return results;
  }
}
