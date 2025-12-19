import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HelpDeskService } from './helpdesk.service';
import { UserGuard } from '../auth/guard/user.guard';
import { HelpdeskAuditInterceptor } from '../audit/helpdesk-audit.interceptor';
import { TicketProjectionItemDto } from './dto/ticket-report.dto';

class TicketsProjectionsResponseDto {
  tickets: TicketProjectionItemDto[];
  projections: TicketProjectionItemDto[];
}

@ApiTags('HelpDesk Reports')
@ApiBearerAuth()
@UseGuards(UserGuard)
@UseInterceptors(HelpdeskAuditInterceptor)
@Controller('helpdesk/reports/tickets')
export class HelpDeskReportsController {
  constructor(private readonly service: HelpDeskService) {}

  @Get()
  @ApiOperation({ summary: 'Tickets e projeções (formato simplificado)' })
  @ApiResponse({ status: 200, type: TicketsProjectionsResponseDto })
  async getTicketsAndProjections(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: any,
    @Res() res: any,
  ): Promise<void> {
    const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
    if (!isDate(startDate) || !isDate(endDate)) {
      throw new BadRequestException(
        'Parâmetros startDate e endDate devem estar no formato YYYY-MM-DD',
      );
    }

    try {
      const report = await this.service.getTicketReport({ startDate, endDate });
      const tickets: TicketProjectionItemDto[] = (report.tickets || []).map(
        (t) => ({
          date: t.date,
          ticker: Math.max(0, Math.round(Number(t.ticker || 0))),
          type: 'TICKET',
        }),
      );
      const projections: TicketProjectionItemDto[] = (
        report.projections || []
      ).map((p) => ({
        date: p.date,
        ticker: Math.max(0, Math.round(Number(p.ticker || 0))),
        type: 'PROJECTION',
      }));

      res.status(200).json({ tickets, projections });
    } catch (err) {
      const message =
        err && err.message
          ? String(err.message)
          : 'Falha ao gerar relatório de tickets';
      res.status(500).json({ error: message });
    }
  }
}
