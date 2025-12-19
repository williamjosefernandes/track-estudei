import { ApiPropertyOptional } from '@nestjs/swagger';

export class HistoryQueryDto {
  @ApiPropertyOptional({ description: 'Página', example: 1 })
  page?: string;

  @ApiPropertyOptional({ description: 'Limite por página', example: 10 })
  limit?: string;

  @ApiPropertyOptional({ description: 'Data inicial (YYYY-MM-DD)' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Data final (YYYY-MM-DD)' })
  endDate?: string;

  @ApiPropertyOptional({ description: 'Categoria', enum: ['study','review','simulation','planning','other'] })
  category?: string;

  @ApiPropertyOptional({ description: 'Termo de busca em título/descrição' })
  search?: string;
}