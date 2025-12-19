import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTicketRequestDto {
  @ApiPropertyOptional({ description: 'Novo status do ticket', example: 'IN_PROGRESS | CLOSED | RESOLVED' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Nova prioridade do ticket', example: 'LOW | MEDIUM | HIGH' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ description: 'Descrição da resolução quando status=RESOLVED' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  resolution?: string;
}