import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationResponseDto } from './dto/notification-response.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUnreadLatest(
    userId: string,
    limitParam?: string,
  ): Promise<NotificationResponseDto[]> {
    const parsed = Number(limitParam);
    const limit =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 5;

    const items = await (this.prisma as any).notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return items.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      url: n.url ?? null,
      read: n.read,
      createdAt: n.createdAt,
    }));
  }
}
