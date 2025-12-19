import { ApiProperty } from '@nestjs/swagger';

export class HistoryResponseDto {
  @ApiProperty({ description: 'ID do registro' })
  id: string;

  @ApiProperty({ description: 'Data (YYYY-MM-DD)' })
  date: string;

  @ApiProperty({ description: 'Hora (HH:mm)' })
  time: string;

  @ApiProperty({ description: 'Categoria', enum: ['study','review','simulation','planning','other'] })
  category: 'study' | 'review' | 'simulation' | 'planning' | 'other';

  @ApiProperty({ description: 'Tipo' })
  type: string;

  @ApiProperty({ description: 'Título' })
  title: string;

  @ApiProperty({ description: 'Descrição', required: false })
  description: string;

  @ApiProperty({ description: 'Duração (minutos)', required: false })
  duration?: number;

  @ApiProperty({ description: 'Matéria', required: false })
  subject?: string;

  @ApiProperty({ description: 'Status', enum: ['completed','in_progress','cancelled'] })
  status: 'completed' | 'in_progress' | 'cancelled';

  @ApiProperty({ description: 'Pontuação', required: false })
  score?: number;

  @ApiProperty({ description: 'Notas', required: false })
  notes?: string;

  @ApiProperty({ description: 'Tags', required: false, type: [String] })
  tags?: string[];
}