import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsArray, ValidateNested, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class CommentAttachmentDto {
  @ApiProperty({ description: 'URL do arquivo', example: 'https://.../file.png' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ description: 'Nome do arquivo', example: 'file.png' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ description: 'Tamanho do arquivo em bytes', example: 2451198 })
  size: number;

  @ApiProperty({ description: 'Tipo MIME', example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  type: string;
}

export class CreateTicketCommentRequestDto {
  @ApiProperty({ description: 'Conteúdo do comentário', example: 'Estou analisando seu chamado.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;

  @ApiProperty({ description: 'Comentário interno (visível apenas para ADMIN)', required: false, example: false })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @ApiProperty({ description: 'Anexos do comentário', type: [CommentAttachmentDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommentAttachmentDto)
  @IsOptional()
  attachments?: CommentAttachmentDto[];
}