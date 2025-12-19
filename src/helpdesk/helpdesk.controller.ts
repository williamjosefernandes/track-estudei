import { Controller, Get, Post, Patch, Query, UseGuards, Body, Req, UploadedFile, UseInterceptors, Param } from '@nestjs/common';
import { HelpDeskService } from './helpdesk.service';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { PaginationResponse } from '../common/pagination/pagination-response.dto';
import { TicketResponseDto } from './dto/ticket-response.dto';
import { TicketCommentResponseDto } from './dto/ticket-comment-response.dto';
import { CreateTicketCommentRequestDto } from './dto/create-ticket-comment-request.dto';
import { CreateTicketRequestDto } from './dto/create-ticket-request.dto';
import { UpdateTicketRequestDto } from './dto/update-ticket-request.dto';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserGuard } from '../auth/guard/user.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import * as fs from 'fs-extra';
import { HelpdeskAuditInterceptor } from '../audit/helpdesk-audit.interceptor';
import { AdminAuthGuard } from '../auth/guard/admin-auth.guard';
import { HelpdeskAuditService } from '../audit/helpdesk-audit.service';

@ApiTags('HelpDesk')
@ApiBearerAuth()
@Controller('helpdesk/tickets')
@UseInterceptors(HelpdeskAuditInterceptor)
export class HelpDeskController {
  constructor(
    private readonly helpdeskService: HelpDeskService,
    private readonly auditService: HelpdeskAuditService,
  ) {}

  @Get()
  @UseGuards(UserGuard)
  @ApiOperation({ summary: 'Listar tickets com filtros e paginação' })
  @ApiResponse({ status: 200, description: 'Lista paginada de tickets' })
  async list(
    @Query() query: ListTicketsQueryDto,
  ): Promise<PaginationResponse<TicketResponseDto>> {
    return this.helpdeskService.listTickets(query);
  }

  @Post()
  @UseGuards(UserGuard)
  @UseInterceptors(
    FileInterceptor('attachments', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dest = join(process.cwd(), 'assets-data', 'helpdesk');
          fs.ensureDirSync(dest);
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const original = file.originalname || 'file';
          const safe = original
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_+/g, '_')
            .toLowerCase();
          const timestamp = Date.now();
          const unique = `${timestamp}_${safe}`;
          cb(null, unique);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Criar novo chamado (ticket)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateTicketRequestDto })
  @ApiResponse({ status: 201, type: TicketResponseDto })
  async create(
    @Body() payload: CreateTicketRequestDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() request,
  ): Promise<TicketResponseDto> {
    const userId = request.user.id as string;

    const attachments = file
      ? [
          {
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            url: `/assets-data/helpdesk/${file.filename}`,
          },
        ]
      : undefined;

    return this.helpdeskService.createTicket(payload, userId, attachments);
  }

  @Get(':id')
  @UseGuards(UserGuard)
  @ApiOperation({ summary: 'Obter ticket por ID' })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  async getById(@Param('id') id: string, @Req() request): Promise<TicketResponseDto> {
    const requester = request.user as { id: string; profile?: string };
    return this.helpdeskService.getTicketById(id, requester);
  }

  @Patch(':id')
  @UseGuards(UserGuard)
  @ApiOperation({ summary: 'Atualizar parcialmente um ticket' })
  @ApiBody({ type: UpdateTicketRequestDto })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  async update(
    @Param('id') id: string,
    @Body() payload: UpdateTicketRequestDto,
    @Req() request,
  ): Promise<TicketResponseDto> {
    const requester = request.user as { id: string; profile?: string };
    return this.helpdeskService.updateTicket(id, requester, payload);
  }

  @Get(':id/comments')
  @UseGuards(UserGuard)
  @ApiOperation({ summary: 'Listar comentários de um ticket' })
  @ApiResponse({ status: 200, type: [TicketCommentResponseDto] })
  async listComments(@Param('id') id: string, @Req() request): Promise<TicketCommentResponseDto[]> {
    const requester = request.user as { id: string; profile?: string };
    return this.helpdeskService.listTicketComments(id, requester);
  }

  @Post(':id/comments')
  @UseGuards(UserGuard)
  @ApiOperation({ summary: 'Cadastrar comentário em um ticket' })
  @ApiBody({ type: CreateTicketCommentRequestDto })
  @ApiResponse({ status: 201, type: TicketCommentResponseDto })
  async addComment(
    @Param('id') id: string,
    @Body() payload: CreateTicketCommentRequestDto,
    @Req() request,
  ): Promise<TicketCommentResponseDto> {
    const requester = request.user as { id: string; profile?: string };
    return this.helpdeskService.addTicketComment(
      id,
      requester,
      payload.content,
      payload.attachments,
      payload.isInternal,
    );
  }

  @Get(':id/audit-log')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Listar auditoria do ticket' })
  async getAuditLog(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.listByTicketId(id, Number(page) || 1, Number(limit) || 50);
  }
}
