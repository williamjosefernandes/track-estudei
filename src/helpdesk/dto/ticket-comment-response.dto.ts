import { ApiProperty } from '@nestjs/swagger';

export class TicketCommentResponseDto {
  @ApiProperty({ description: 'ID do comentário', example: 'c123-uuid' })
  id: string;

  @ApiProperty({ description: 'ID do ticket', example: 't123-uuid' })
  ticketId: string;

  @ApiProperty({ description: 'Nome do usuário autor', example: 'Maria Silva' })
  userName: string;

  @ApiProperty({ description: 'Perfil do usuário autor', example: 'STUDENT' })
  profile: string;

  @ApiProperty({ description: 'Avatar do usuário autor', example: 'https://.../avatar.png', required: false })
  avatar?: string;

  @ApiProperty({ description: 'Anexos do comentário', example: [
    { url: 'https://.../file.png', fileName: 'file.png', size: 2451198, type: 'image/png' },
    { url: 'https://.../file.jpeg', fileName: 'file.jpeg', size: 88901, type: 'image/jpeg' },
  ] })
  attachments?: any[];

  @ApiProperty({ description: 'Conteúdo do comentário', example: 'Estamos analisando seu chamado.' })
  content: string;

  @ApiProperty({ description: 'Data de criação', example: new Date().toISOString() })
  createdAt: Date;
}