import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTicketRequestDto {
  @ApiProperty({ description: 'Título do chamado' })
  title: string;

  @ApiProperty({ description: 'Descrição detalhada do problema' })
  description: string;

  @ApiProperty({ description: 'Categoria do chamado', example: 'Bug' })
  category: string;

  @ApiProperty({ description: 'Prioridade do chamado', example: 'LOW | MEDIUM | HIGH' })
  priority: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Anexo (arquivo único)' })
  attachments?: any;
}