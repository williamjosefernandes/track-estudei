import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HistoryQueryDto } from './dto/request/history-query.dto';
import { HistoryResponseDto } from './dto/response/history-response.dto';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: HistoryQueryDto, userId: string): Promise<HistoryResponseDto[]> {
    const take = query.limit ? parseInt(query.limit, 10) : undefined;
    const page = query.page ? parseInt(query.page, 10) : undefined;
    const skip = take && page ? (page - 1) * take : undefined;

    const where: Prisma.AuditWhereInput = {
      userId,
      ...(query.startDate
        ? { createdAt: { gte: new Date(`${query.startDate}T00:00:00.000Z`) } }
        : {}),
      ...(query.endDate
        ? { createdAt: { lte: new Date(`${query.endDate}T23:59:59.999Z`) } }
        : {}),
      ...(query.search
        ? { entity: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const audits = await this.prisma.audit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const items = audits.map((a) => this.mapAuditToHistory(a));

    // Optional category filter after mapping
    const filtered = query.category
      ? items.filter((i) => i.category === (query.category as any))
      : items;

    return filtered;
  }

  async getById(id: string, userId: string): Promise<HistoryResponseDto> {
    const a = await this.prisma.audit.findFirst({ where: { id, userId } });
    if (!a) {
      throw new Error('HISTORY_NOT_FOUND');
    }
    return this.mapAuditToHistory(a);
  }

  private mapAuditToHistory(a: Prisma.AuditGetPayload<{ include?: any }>): HistoryResponseDto {
    const created = a.createdAt ?? new Date();
    const date = created.toISOString().slice(0, 10);
    const time = created.toISOString().slice(11, 16);

    const category = this.mapEntityToCategory(a.entity);
    const title = `${a.entity} ${a.action}`;

    return {
      id: a.id,
      date,
      time,
      category,
      type: a.action,
      title,
      description: '',
      status: 'completed',
      tags: [a.entity],
    };
  }

  private mapEntityToCategory(entity: string): 'study' | 'review' | 'simulation' | 'planning' | 'other' {
    const e = (entity || '').toLowerCase();
    if (['subject', 'topic', 'subtopic', 'trail', 'trailtopic', 'trailsubject'].some((k) => e.includes(k))) {
      return 'study';
    }
    if (['studyplan', 'cronograma'].some((k) => e.includes(k))) {
      return 'planning';
    }
    if (['simulation', 'simulado'].some((k) => e.includes(k))) {
      return 'simulation';
    }
    if (['review', 'revisao'].some((k) => e.includes(k))) {
      return 'review';
    }
    return 'other';
  }
}