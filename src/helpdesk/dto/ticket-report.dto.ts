import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { TicketCategory } from '@prisma/client';

export class TicketReportQueryDto {
  @ApiPropertyOptional({ description: 'Categoria específica dos tickets' })
  @IsOptional()
  @IsString()
  category?: TicketCategory;

  @ApiProperty({ description: 'Data inicial (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @ApiProperty({ description: 'Data final (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string;
}

export class TicketReportPeriodDto {
  @ApiProperty({ description: 'Data inicial do período (YYYY-MM-DD)' })
  startDate: string;

  @ApiProperty({ description: 'Data final do período (YYYY-MM-DD)' })
  endDate: string;

  @ApiProperty({ description: 'Total de tickets no período' })
  totalTickets: number;

  @ApiProperty({
    description: 'Dias úteis no período (sem fins de semana e feriados fixos)',
  })
  workingDays: number;

  @ApiProperty({ description: 'Taxa por dia útil (tickets/dia útil)' })
  ratePerBusinessDay: number;
}

export class TicketReportDailyItemDto {
  @ApiProperty({ description: 'Data (YYYY-MM-DD)' })
  date: string;

  @ApiPropertyOptional({
    description: 'Total de novos tickets na data (histórico)',
  })
  total?: number;

  @ApiPropertyOptional({ description: 'Quantidade real (histórico)' })
  quantidade_real?: number;

  @ApiPropertyOptional({ description: 'Quantidade projetada (futuro)' })
  quantidade_projetada?: number;

  @ApiPropertyOptional({
    description: 'Intervalo de confiança 95% (inferior/superior)',
  })
  intervalo_confianca?: { inferior: number; superior: number };

  @ApiPropertyOptional({ description: 'Tendência' })
  tendencia?: 'aumento' | 'diminuicao' | 'estabilidade';
}

export class TicketReportSeriesItemDto {
  @ApiProperty({ description: 'Data (ISO 8601 YYYY-MM-DD)' })
  data: string;

  @ApiPropertyOptional({ description: 'Quantidade real (para histórico)' })
  quantidade_real?: number;

  @ApiPropertyOptional({
    description: 'Quantidade projetada (para próximos dias)',
  })
  quantidade_projetada?: number;

  @ApiPropertyOptional({
    description: 'Intervalo de confiança 95% (inferior/superior)',
  })
  intervalo_confianca?: { inferior: number; superior: number };

  @ApiPropertyOptional({ description: 'Tendência do dia projetado' })
  tendencia?: 'aumento' | 'diminuicao' | 'estabilidade';
}

export class TicketReportMetadataDto {
  @ApiProperty({ description: 'Método de projeção utilizado' })
  projectionMethod: 'ARIMA' | string;

  @ApiProperty({ description: 'Nível de confiança utilizado' })
  confidenceLevel: number;

  @ApiPropertyOptional({ description: 'Coeficiente de determinação' })
  r2?: number;

  @ApiPropertyOptional({ description: 'Raiz do erro quadrático médio' })
  rmse?: number;

  @ApiProperty({ description: 'Ordenação da série' })
  ordenacao: 'asc' | 'desc';

  @ApiProperty({ description: 'Tamanho da janela de treino' })
  trainingWindow: number;

  @ApiProperty({ description: 'Horizonte de previsão' })
  forecastHorizon: number;

  @ApiProperty({ description: 'Última data histórica usada' })
  lastDate: string;

  @ApiPropertyOptional({ description: 'Categoria filtrada' })
  category?: string;

  @ApiPropertyOptional({ description: 'Data inicial da consulta' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Data final da consulta' })
  endDate?: string;

  @ApiPropertyOptional({ description: 'Dias úteis considerados' })
  workingDays?: number;

  @ApiPropertyOptional({ description: 'Dias úteis do período anterior' })
  previousWorkingDays?: number;

  @ApiPropertyOptional({ description: 'Informação de cache' })
  cache?: {
    ttlSegundos: number;
    hit: boolean;
  };
}

export class TicketProjectionItemDto {
  @ApiProperty({ description: 'Data (YYYY-MM-DD)' })
  date: string;

  @ApiProperty({
    description: 'Quantidade de tickets (histórico ou projetado)',
  })
  ticker: number;

  @ApiProperty({ description: 'Tipo do item' })
  type: 'TICKET' | 'PROJECTION';
}

export class TicketReportResponseDto {
  @ApiProperty({
    description: 'Série diária com total de novos tickets por data',
    type: [TicketReportDailyItemDto],
  })
  data: TicketReportDailyItemDto[];

  @ApiProperty({ description: 'Porcentagem de variação vs período anterior' })
  variacao: number;

  @ApiPropertyOptional({
    description: 'Série completa com histórico e projeção',
    type: () => TicketReportSeriesItemDto,
    isArray: true,
  })
  serie?: TicketReportSeriesItemDto[];

  @ApiPropertyOptional({
    description: 'Metadados da projeção e qualidade',
    type: () => TicketReportMetadataDto,
  })
  metadados?: TicketReportMetadataDto;

  @ApiPropertyOptional({
    description: 'Itens históricos no formato simplificado',
    type: () => TicketProjectionItemDto,
    isArray: true,
  })
  tickets?: TicketProjectionItemDto[];

  @ApiPropertyOptional({
    description: 'Itens projetados (7 dias) no formato simplificado',
    type: () => TicketProjectionItemDto,
    isArray: true,
  })
  projections?: TicketProjectionItemDto[];
}
