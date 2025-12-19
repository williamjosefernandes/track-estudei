import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { BadRequestException } from '@nestjs/common';
import { UpdateUserRequestDto } from './dto/request/update-user-request.dto';
import { User } from './dto/user.entity';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationResponse } from '../common/pagination/pagination-response.dto';
import { ErrorDetails } from '../common/exceptions/system-exception';
import { CreateUserRequestDto } from './dto/request/create-user-request.dto';
import { UserResponseDto } from './dto/response/user-response.dto';
import { DeleteUserResponseDto } from './dto/response/delete-user-response.dto';
import { DeleteUserRequestDto } from './dto/request/delete-user-request.dto';
import { InativeUserRequestDto } from './dto/request/inative-user-request.dto';
import { InativeUserResponseDto } from './dto/response/inative-user-response.dto';
import { UserGuard } from 'src/auth/guard/user.guard';
import { UpdatePasswordRequestDto } from './dto/request/update-password-request.dto';
import { AuthResponseDto } from 'src/auth/dto/response/auth-response.dto';
import { AuditGuard } from 'src/common/guard/audit.guard';
import { Request } from 'express';
import { CompleteProfileRequestDto } from './dto/request/complete-profile-request.dto';
import { ProfilesResponseDto } from './dto/response/profiles-response.dto';
import { UpdateAvatarRequestDto } from './dto/request/update-avatar-request.dto';

@ApiTags('Usuário')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiResponse({
    status: 201,
    description: 'Usuário criado com sucesso',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Erro na requisição' })
  @ApiResponse({
    status: ErrorDetails.EMAIL_CONFLICT.status,
    description: ErrorDetails.EMAIL_CONFLICT.message,
  })
  @ApiResponse({
    status: ErrorDetails.PERSONAL_DOCUMENT_CONFLICT.status,
    description: ErrorDetails.PERSONAL_DOCUMENT_CONFLICT.message,
  })
  @ApiOperation({ summary: 'Criar um novo usuário' })
  async createUser(
    @Body() createUserDto: CreateUserRequestDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.userService.create(createUserDto, req.headers.origin);
  }

  @Get('avatar')
  @ApiOperation({ summary: 'Obter o avatar do usuário logado' })
  @ApiResponse({
    status: 200,
    description: 'Avatar recuperado com sucesso',
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          nullable: true,
          description: 'URL do avatar do usuário',
        },
      },
    },
  })
  @UseGuards(UserGuard)
  @ApiBearerAuth()
  async getAvatar(@Req() request): Promise<{ avatar: string | null }> {
    const userId = request.user.id;
    return this.userService.getAvatar(userId);
  }

  @Get('profiles')
  @ApiResponse({
    status: 200,
    description: 'Perfis encontrados com sucesso',
    type: ProfilesResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Erro na requisição' })
  @ApiOperation({ summary: 'Obter todos os perfis' })
  async profiles(): Promise<ProfilesResponseDto[]> {
    return this.userService.profiles();
  }

  @Get('all')
  @ApiResponse({
    status: 200,
    description: 'Usuários encontrados com sucesso',
    type: PaginationResponse,
  })
  @ApiBadRequestResponse({ description: 'Erro na requisição' })
  @ApiResponse({
    status: ErrorDetails.INVALID_PAGINATION_PARAMETERS.status,
    description: ErrorDetails.INVALID_PAGINATION_PARAMETERS.message,
  })
  @ApiOperation({ summary: 'Obter todos os usuários' })
  async findAll(
    @Query('page-number') page?: string,
    @Query('page-size') limit?: string,
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query('profile') profile?: string,
    @Query('status') status?: string,
  ): Promise<PaginationResponse<UserResponseDto>> {
    const pageNumber = parseInt(page || '1');
    const pageSize = parseInt(limit || '10');

    const filters = {
      name,
      email,
      profile,
      status,
    };

    return this.userService.findAll(pageNumber, pageSize, filters);
  }

  @Get('check-email')
  @ApiOperation({ summary: 'Verificar se o e-mail está cadastrado' })
  @ApiResponse({
    status: 200,
    description: 'E-mail verificado com sucesso',
    type: Boolean,
  })
  @ApiBadRequestResponse({ description: 'Erro na requisição' })
  async checkEmail(
    @Query('email') email: string,
  ): Promise<{ exists: boolean }> {
    if (!email) {
      throw new BadRequestException('O parâmetro "email" é obrigatório');
    }

    const exists = await this.userService.isEmailRegistered(email);
    return { exists };
  }

  @Get(':id')
  @ApiResponse({
    status: 200,
    description: 'Usuário encontrado com sucesso',
    type: User,
  })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  @ApiOperation({ summary: 'Obter usuário por ID' })
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiResponse({
    status: 200,
    description: 'Usuário atualizado com sucesso',
    type: User,
  })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  @ApiBadRequestResponse({ description: 'Erro na requisição' })
  @ApiOperation({ summary: 'Atualizar usuário por ID' })
  @UseGuards(UserGuard)
  @AuditGuard()
  @ApiBearerAuth()
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserRequestDto,
  ): Promise<UserResponseDto> {
    return this.userService.update(id, updateUserDto);
  }

  @AuditGuard()
  @Delete()
  @ApiResponse({
    status: 200,
    description: 'Usuários removidos com sucesso',
    type: DeleteUserResponseDto,
  })
  @ApiOperation({ summary: 'Excluir usuários' })
  @UseGuards(UserGuard)
  @AuditGuard()
  @ApiBearerAuth()
  async remove(
    @Body() requestDto: DeleteUserRequestDto,
  ): Promise<DeleteUserResponseDto> {
    const { ids } = requestDto;
    return this.userService.remove(ids);
  }

  @Post('inactivate')
  @ApiOperation({ summary: 'Desativar usuários' })
  @ApiResponse({
    status: 200,
    description: 'Usuários desativados com sucesso',
    type: InativeUserRequestDto,
  })
  @UseGuards(UserGuard)
  @AuditGuard()
  @ApiBearerAuth()
  async deactivateUsers(
    @Body() requestDto: InativeUserRequestDto,
  ): Promise<InativeUserResponseDto> {
    return this.userService.deactivateUsers(requestDto);
  }

  @ApiOperation({ summary: 'Trocar a senha do usuário logado' })
  @ApiResponse({
    status: 200,
    description: 'Alteração de senha realizada com sucesso',
    type: AuthResponseDto,
  })
  @UseGuards(UserGuard)
  @AuditGuard()
  @ApiBearerAuth()
  @Put('password')
  async updatePassword(
    @Req() request,
    @Body() { newPassword, oldPassword }: UpdatePasswordRequestDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.userService.updatePassword(
      request.user,
      oldPassword,
      newPassword,
    );
  }

  @Put('complete-profile')
  @ApiOperation({ summary: 'Completar o perfil do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Perfil atualizado com sucesso',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Erro na requisição' })
  @ApiBearerAuth()
  @UseGuards(UserGuard)
  async completeProfile(
    @Req() request,
    @Body() completeProfileDto: CompleteProfileRequestDto,
  ): Promise<void> {
    const userId = request.user.id;
    this.userService.completeProfile(userId, completeProfileDto);
  }

  @Put('avatar')
  @ApiOperation({ summary: 'Atualizar o avatar do usuário logado' })
  @ApiResponse({
    status: 200,
    description: 'Avatar atualizado com sucesso',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Erro na requisição' })
  @ApiResponse({
    status: 404,
    description: 'Usuário não encontrado',
  })
  @ApiBearerAuth()
  @UseGuards(UserGuard)
  async updateAvatar(
    @Req() request,
    @Body() updateAvatarDto: UpdateAvatarRequestDto,
  ): Promise<UserResponseDto> {
    const userId = request.user.id;
    return this.userService.updateAvatar(userId, updateAvatarDto.avatar);
  }
}
