import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserGuard } from '../auth/guard/user.guard';
import { HistoryService } from './history.service';
import { HistoryQueryDto } from './dto/request/history-query.dto';
import { HistoryResponseDto } from './dto/response/history-response.dto';

@ApiTags('History')
@Controller('history')
@UseGuards(UserGuard)
@ApiBearerAuth()
export class HistoryController {
  constructor(private readonly service: HistoryService) {}

  @Get()
  @ApiOperation({ summary: 'Listar histórico do usuário autenticado' })
  @ApiResponse({ status: 200, type: [HistoryResponseDto] })
  async list(@Query() query: HistoryQueryDto, @Req() req): Promise<HistoryResponseDto[]> {
    const userId = req.user.id;
    return this.service.list(query, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter registro de histórico por ID' })
  @ApiResponse({ status: 200, type: HistoryResponseDto })
  async getById(@Param('id') id: string, @Req() req): Promise<HistoryResponseDto> {
    const userId = req.user.id;
    return this.service.getById(id, userId);
  }
}