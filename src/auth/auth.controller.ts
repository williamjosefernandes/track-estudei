import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthRequestDto } from './dto/request/auth-request.dto';
import { AuthResponseDto } from './dto/response/auth-response.dto';
import { ResetPasswordDto } from './dto/request/reset-password-request.dto';
import { ChangePasswordDto } from './dto/request/change-password-resquest.dto';
import { ResetPasswordResponseDto } from './dto/response/reset-password-response.dto';
import { ChangePasswordResponseDto } from './dto/response/change-password-response.dto';
import { Request } from 'express';
import { UserGuard } from './guard/user.guard';
import { CheckTokenRequestDto } from './dto/request/check-token-request.dto';
import { TokenEmailResquestDto } from './dto/request/token-email-resquest.dto';
import { SendCheckEmailRequestDto } from './dto/request/send-check-email-request.dto';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @ApiOperation({ summary: 'Realizar login' })
  @ApiCreatedResponse({
    description: 'Login bem-sucedido',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Requisição inválida' })
  @ApiResponse({ status: 401, description: 'Email ou senha inválidos' })
  async login(
    @Body() authRequestDto: AuthRequestDto,
  ): Promise<AuthResponseDto> {
    const authResponseDto =
      await this.authService.authenticateUser(authRequestDto);
    if (!authResponseDto) {
      throw new UnauthorizedException('INVALID_EMAIL_OR_PASSWORD');
    }
    return authResponseDto;
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Redefinir senha' })
  @ApiCreatedResponse({
    description: 'Token de redefinição de senha gerado com sucesso',
    type: ResetPasswordResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Requisição inválida' })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Req() req: Request,
  ): Promise<ResetPasswordResponseDto> {
    const { email } = resetPasswordDto;
    return await this.authService.resetPassword(email, req.headers.origin);
  }

  @Post('check-code-reset-password')
  @ApiOperation({ summary: 'Redefinir senha' })
  @ApiCreatedResponse({
    description: 'Verifica se o token de redefinição é valido',
    type: ResetPasswordResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Requisição inválida' })
  async checkCodeResetPassword(
    @Body() checkTokenRequestDto: CheckTokenRequestDto,
  ): Promise<ChangePasswordResponseDto> {
    const { token } = checkTokenRequestDto;
    return await this.authService.checkCodeResetPassword(token);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Alterar senha' })
  @ApiCreatedResponse({
    description: 'Senha alterada com sucesso',
    type: ChangePasswordResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Requisição inválida' })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<AuthResponseDto> {
    const { token, password, passwordConfirmation } = changePasswordDto;
    return await this.authService.changePassword(
      token,
      password,
      passwordConfirmation,
    );
  }

  @Post('logout')
  @UseGuards(UserGuard)
  @ApiBearerAuth()
  async logout(@Req() req: any) {
    const userId = req.user.id;

    await this.authService.logout(userId);

    return { message: 'Usuário desconectado com sucesso' };
  }

  @Post('send-confirm-email')
  @ApiOperation({ summary: 'Confirmar email com base no token' })
  @ApiCreatedResponse({
    description: 'Email confirmado com sucesso',
  })
  @ApiBadRequestResponse({ description: 'Requisição inválida' })
  async sendConfirmEmail(
    @Body() tokenEmailResquestDto: SendCheckEmailRequestDto,
    @Req() req: Request,
  ) {
    return await this.authService.sendConfirmEmail(
      tokenEmailResquestDto,
      req.headers.origin,
    );
  }

  @Post('confirm-email')
  @ApiOperation({ summary: 'Confirmar email com base no token' })
  @ApiCreatedResponse({
    description: 'Email confirmado com sucesso',
  })
  @ApiBadRequestResponse({ description: 'Requisição inválida' })
  async confirmEmail(@Body() tokenEmailResquestDto: TokenEmailResquestDto) {
    return await this.authService.confirmEmail(tokenEmailResquestDto);
  }

  @Get('validate')
  @ApiOperation({ summary: 'Validar token JWT' })
  @ApiResponse({ status: 200, description: 'Token válido' })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado' })
  async validate(@Req() req: Request): Promise<void> {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      throw new UnauthorizedException('Token ausente');
    }

    const [type, token] = authorizationHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Formato de token inválido');
    }

    try {
      await this.authService.validateToken(token);
      // Return 200 with empty body for valid tokens
    } catch {
      // Return 401 for any validation errors
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
