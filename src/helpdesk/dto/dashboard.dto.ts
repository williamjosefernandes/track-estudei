import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardOverviewResponseDto {
  @ApiProperty({ description: 'Quantidade de tickets abertos' })
  open: number;

  @ApiProperty({ description: 'Quantidade de tickets em andamento' })
  inProgress: number;

  @ApiProperty({ description: 'Quantidade de tickets fechados' })
  closed: number;

  @ApiProperty({ description: 'Quantidade de tickets com SLA em risco' })
  slaRisk: number;

  @ApiProperty({ description: 'Quantidade de tickets críticos (não fechados)' })
  critical: number;
}

export class DashboardIndicatorsResponseDto {
  @ApiProperty({ description: 'Taxa de resolução (%)', example: 87.5 })
  resolutionRatePercent: number;

  @ApiProperty({ description: 'Tempo médio até resolução (horas)', example: 12.3 })
  averageResolutionTimeHours: number;
}

export class PriorityDistributionResponseDto {
  @ApiProperty({ description: 'Tickets de prioridade baixa' })
  low: number;

  @ApiProperty({ description: 'Tickets de prioridade média' })
  medium: number;

  @ApiProperty({ description: 'Tickets de prioridade alta' })
  high: number;

  @ApiProperty({ description: 'Tickets de prioridade crítica' })
  critical: number;
}

export class SlaAlertsQueryDto {
  @ApiPropertyOptional({ description: 'Filtro por gravidade/prioridade (LOW|MEDIUM|HIGH|CRITICAL)' })
  severity?: string;

  @ApiPropertyOptional({ description: 'Filtro por status' })
  status?: string;

  @ApiPropertyOptional({ description: 'Data inicial (ISO)', example: new Date().toISOString() })
  from?: string;

  @ApiPropertyOptional({ description: 'Data final (ISO)', example: new Date().toISOString() })
  to?: string;
}

export class SlaAlertItemDto {
  @ApiProperty({ description: 'ID do ticket' })
  id: string;

  @ApiProperty({ description: 'Título do ticket' })
  title: string;

  @ApiProperty({ description: 'Prioridade (LOW|MEDIUM|HIGH|CRITICAL)' })
  priority: string;

  @ApiProperty({ description: 'Status do ticket' })
  status: string;

  @ApiProperty({ description: 'Data de criação' })
  createdAt: Date;

  @ApiProperty({ description: 'Idade em horas desde a abertura' })
  ageHours: number;

  @ApiProperty({ description: 'Limite de SLA em horas para a prioridade' })
  thresholdHours: number;

  @ApiProperty({ description: 'Indica se a SLA foi ultrapassada', example: true })
  breached: boolean;
}

export class ErrorEndpointCountDto {
  @ApiProperty({ description: 'Endpoint da requisição' })
  endpoint: string;

  @ApiProperty({ description: 'Total de erros no endpoint' })
  total: number;
}

export class ErrorEndpointRecentDto {
  @ApiProperty({ description: 'Endpoint da requisição' })
  endpoint: string;

  @ApiProperty({ description: 'Total de erros no período' })
  total: number;

  @ApiProperty({ description: 'Data/hora do último erro' })
  lastErrorAt: Date;
}

export class TopErrorEndpointsQueryDto {
  @ApiPropertyOptional({ description: 'Limite de resultados', example: 10 })
  limit?: number;

  @ApiPropertyOptional({ description: 'Data inicial (ISO) para filtro', example: new Date().toISOString() })
  from?: string;

  @ApiPropertyOptional({ description: 'Data final (ISO) para filtro', example: new Date().toISOString() })
  to?: string;
}

export class RecentErrorEndpointsQueryDto {
  @ApiPropertyOptional({ description: 'Período em horas para considerar "recentes"', example: 24 })
  hours?: number;

  @ApiPropertyOptional({ description: 'Limite de resultados', example: 10 })
  limit?: number;
}