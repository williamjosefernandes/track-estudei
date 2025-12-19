import { ApiProperty } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty({ description: 'ID da notificação', example: 'n123-uuid' })
  id: string;

  @ApiProperty({ description: 'Título da notificação', example: 'Novo comentário no seu ticket' })
  title: string;

  @ApiProperty({ description: 'Corpo da notificação', example: 'Seu ticket foi atualizado.' })
  body: string;

  @ApiProperty({ description: 'URL relacionada', example: '/helpdesk/tickets/abc-uuid', required: false })
  url?: string | null;

  @ApiProperty({ description: 'Lida', example: false })
  read: boolean;

  @ApiProperty({ description: 'Data de criação', example: new Date().toISOString() })
  createdAt: Date;
}