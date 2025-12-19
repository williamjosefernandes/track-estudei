import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { UserGuard } from '../auth/guard/user.guard';

@ApiTags('Notificações')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get('unread-latest')
  @UseGuards(UserGuard)
  @ApiOperation({ summary: 'Listar notificações não lidas mais recentes' })
  @ApiResponse({ status: 200, type: [NotificationResponseDto] })
  async unreadLatest(@Query('limit') limit: string, @Req() request): Promise<NotificationResponseDto[]> {
    const userId = request.user.id as string;
    return this.service.getUnreadLatest(userId, limit);
  }
}