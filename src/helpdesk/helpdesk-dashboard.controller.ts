import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HelpDeskService } from './helpdesk.service';
import { AdminAuthGuard } from '../auth/guard/admin-auth.guard';
import { HelpdeskAuditInterceptor } from '../audit/helpdesk-audit.interceptor';
import {
  DashboardOverviewResponseDto,
  DashboardIndicatorsResponseDto,
  PriorityDistributionResponseDto,
  SlaAlertItemDto,
  SlaAlertsQueryDto,
  ErrorEndpointCountDto,
  ErrorEndpointRecentDto,
  TopErrorEndpointsQueryDto,
  RecentErrorEndpointsQueryDto,
} from './dto/dashboard.dto';

@ApiTags('HelpDesk Admin Dashboard')
@ApiBearerAuth()
@Controller('helpdesk/admin/dashboard')
@UseGuards(AdminAuthGuard)
@UseInterceptors(HelpdeskAuditInterceptor)
export class HelpDeskDashboardController {
  constructor(private readonly helpdeskService: HelpDeskService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Visão geral de tickets' })
  @ApiResponse({ status: 200, type: DashboardOverviewResponseDto })
  async getOverview(): Promise<DashboardOverviewResponseDto> {
    return this.helpdeskService.getDashboardOverview();
  }

  @Get('indicators')
  @ApiOperation({ summary: 'Indicadores de desempenho' })
  @ApiResponse({ status: 200, type: DashboardIndicatorsResponseDto })
  async getIndicators(): Promise<DashboardIndicatorsResponseDto> {
    return this.helpdeskService.getDashboardIndicators();
  }

  @Get('priority-distribution')
  @ApiOperation({ summary: 'Distribuição por prioridade' })
  @ApiResponse({ status: 200, type: PriorityDistributionResponseDto })
  async getPriorityDistribution(): Promise<PriorityDistributionResponseDto> {
    return this.helpdeskService.getPriorityDistribution();
  }

  @Get('sla-alerts')
  @ApiOperation({ summary: 'Alertas de SLA (lista) com filtros' })
  @ApiResponse({ status: 200, type: [SlaAlertItemDto] })
  async getSlaAlerts(@Query() query: SlaAlertsQueryDto): Promise<SlaAlertItemDto[]> {
    return this.helpdeskService.listSlaAlerts(query);
  }

  @Get('audit/top-error-endpoints')
  @ApiOperation({ summary: 'Endpoints com maior número de erros' })
  @ApiResponse({ status: 200, type: [ErrorEndpointCountDto] })
  async getTopErrorEndpoints(@Query() query: TopErrorEndpointsQueryDto): Promise<ErrorEndpointCountDto[]> {
    return this.helpdeskService.getTopErrorEndpoints(query);
  }

  @Get('audit/recent-error-endpoints')
  @ApiOperation({ summary: 'Endpoints com erros recentes' })
  @ApiResponse({ status: 200, type: [ErrorEndpointRecentDto] })
  async getRecentErrorEndpoints(@Query() query: RecentErrorEndpointsQueryDto): Promise<ErrorEndpointRecentDto[]> {
    return this.helpdeskService.getRecentErrorEndpoints(query);
  }
}