import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthToken, User } from '@prisma/client';
import { AuthRequestDto } from './dto/request/auth-request.dto';
import { AuthResponseDto } from './dto/response/auth-response.dto';
import { SystemException } from '../common/exceptions/system-exception';
import { ValidationUtilsService } from 'src/common/utils/validation-utils.service';
import { BcryptService } from '../common/services/bcrypt.service';
import { EmailService } from 'src/email/email.service';
import { ResetPasswordResponseDto } from './dto/response/reset-password-response.dto';
import { UserResponseDto } from '../user/dto/response/user-response.dto';
import { TokenEmailResquestDto } from './dto/request/token-email-resquest.dto';
import { SendCheckEmailRequestDto } from './dto/request/send-check-email-request.dto';

@Injectable()
export class AuthService {
  private readonly EXPIRES_IN: number = 24 * 3600;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly validationUtilsService: ValidationUtilsService,
    private readonly bcryptService: BcryptService,
    private readonly emailService: EmailService,
  ) {}

  async authenticateUser(
    authRequestDto: AuthRequestDto,
  ): Promise<AuthResponseDto | null> {
    const email = authRequestDto.email.trim().toLowerCase();
    const { password, checkme } = authRequestDto;

    const user = await this.prismaService.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new SystemException('INVALID_EMAIL_OR_PASSWORD');
    }

    const isPasswordValid = await this.bcryptService.comparePasswords(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new SystemException('INVALID_EMAIL_OR_PASSWORD');
    }

    // Set token expiration based on 'checkme' flag
    const expirationTime = checkme ? 30 * 24 * 3600 : this.EXPIRES_IN;
    const { accessToken, expiresIn } = await this.generateAccessToken(
      user,
      expirationTime,
    );

    const authToken = await this.saveAuthToken(user.id, accessToken, expiresIn);

    const userResponseDto: UserResponseDto = {
      id: user.id,
      avatar: user.avatar,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profile: user.profile,
    };

    return new AuthResponseDto(
      userResponseDto,
      authToken.token,
      authToken.expiresAt.getTime(),
    );
  }

  async generateAccessToken(
    user: User,
    expiresIn?: number,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const payload = {
      id: user.id,
      email: user.email,
      profile: user.profile,
    };

    // Configura o tempo de expiração baseado no parâmetro expiresIn ou usa o padrão EXPIRES_IN
    const tokenExpiresIn = expiresIn || this.EXPIRES_IN;

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: tokenExpiresIn,
    });

    return { accessToken, expiresIn: tokenExpiresIn };
  }

  async saveAuthToken(
    userId: string,
    token: string,
    expiresIn: number,
  ): Promise<AuthToken> {
    const currentDateTime = new Date();
    const expiresAt = new Date(currentDateTime.getTime() + expiresIn * 1000);

    return this.prismaService.authToken.create({
      data: {
        token,
        expiresAt,
        user: {
          connect: { id: userId },
        },
      },
    });
  }

  async resetPassword(
    email: string,
    origin: string,
  ): Promise<ResetPasswordResponseDto> {
    const user = await this.prismaService.user.findUnique({ where: { email } });
    if (!user) {
      throw new SystemException('USER_NOT_FOUND');
    }

    const authToken = await this.generateAuthToken(user.id);
    const url = `${origin}/auth/change-password?token=${authToken.token}`;

    await this.emailService.resetPassword({
      url,
      name: user.firstName,
      email,
    });

    return { success: true };
  }

  async changePassword(
    token: string,
    password: string,
    passwordConfirmation: string,
  ): Promise<AuthResponseDto> {
    if (password !== passwordConfirmation) {
      throw new SystemException('PASSWORDS_DO_NOT_MATCH');
    }

    const currentDateTime = await new Date();
    const authToken = await this.prismaService.authToken.findFirst({
      where: {
        token: token,
        expiresAt: { gt: currentDateTime },
      },
    });

    if (!authToken) {
      throw new SystemException('INVALID_TOKEN');
    }

    if (currentDateTime > authToken.expiresAt) {
      await this.prismaService.authToken.delete({
        where: { id: authToken.id },
      });
      throw new SystemException('TOKEN_EXPIRED');
    }

    const [isPasswordStrong, message] =
      this.validationUtilsService.isPasswordStrong(password);
    if (!isPasswordStrong) {
      throw new SystemException('WEAK_PASSWORD', message);
    }

    const hashedPassword = await this.bcryptService.hashPassword(password);

    const user = await this.prismaService.user.update({
      where: { id: authToken.userId },
      data: { password: hashedPassword, emailConfirmed: true },
    });

    await this.prismaService.authToken.delete({
      where: { id: authToken.id },
    });

    // Set token expiration based on 'checkme' flag
    const checkme = true;
    const expirationTime = checkme ? 30 * 24 * 3600 : this.EXPIRES_IN;
    const { accessToken, expiresIn } = await this.generateAccessToken(
      user,
      expirationTime,
    );

    const authTokenUser = await this.saveAuthToken(
      user.id,
      accessToken,
      expiresIn,
    );

    const userResponseDto: UserResponseDto = {
      id: user.id,
      avatar: user.avatar,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profile: user.profile,
    };

    return new AuthResponseDto(
      userResponseDto,
      authTokenUser.token,
      authTokenUser.expiresAt.getTime(),
    );
  }

  async generateAuthToken(userId: string): Promise<AuthToken> {
    const currentDateTime = await new Date();

    const existingToken = await this.prismaService.authToken.findFirst({
      where: {
        user: { id: userId },
        expiresAt: { gt: currentDateTime },
      },
    });

    if (existingToken) {
      const newExpiresAt = new Date(
        currentDateTime.getTime() + this.EXPIRES_IN * 1000,
      );
      return this.prismaService.authToken.update({
        where: { id: existingToken.id },
        data: { expiresAt: newExpiresAt },
      });
    }

    const { accessToken, expiresIn } = await this.generateAccessToken(
      { id: userId } as User,
      this.EXPIRES_IN,
    );

    return this.saveAuthToken(userId, accessToken, expiresIn);
  }

  async logout(userId: string): Promise<void> {
    // Remover todos os tokens de autenticação associados ao usuário
    await this.prismaService.authToken.deleteMany({
      where: {
        userId: userId,
      },
    });
  }

  async checkCodeResetPassword(token: string) {
    const currentDateTime = await new Date();
    const authToken = await this.prismaService.authToken.findFirst({
      where: {
        token: token,
      },
    });

    if (!authToken) {
      throw new SystemException('INVALID_TOKEN_PASSWORD');
    }
    if (authToken.expiresAt < currentDateTime) {
      throw new SystemException('TOKEN_EXPIRED_PASSWORD');
    }

    return { success: true };
  }

  async sendConfirmEmail(
    tokenEmailRequestDto: SendCheckEmailRequestDto,
    origin: string,
  ): Promise<{ success: true }> {
    const { email } = tokenEmailRequestDto;

    // Validate email format
    if (!this.validationUtilsService.isValidEmail(email)) {
      throw new SystemException(
        'INVALID_EMAIL',
        'Provided email is not valid.',
      );
    }

    const user = await this.prismaService.user.findUnique({ where: { email } });

    if (!user) {
      throw new SystemException('USER_NOT_FOUND');
    }

    const emailUrl = `${origin}/check-mail?emailToken=${user.emailToken}`;

    try {
      await this.emailService.confirmEmail({
        email,
        name: user.firstName,
        url: emailUrl,
      });
      console.log(`Confirmation email sent successfully to ${email}`);
    } catch (error) {
      console.error(`Failed to send confirmation email to ${email}:`, error);
      throw new SystemException(
        'EMAIL_SERVICE_FAILURE',
        'Falha ao enviar e-mail. Tente novamente mais tarde.',
      );
    }

    return { success: true };
  }

  async confirmEmail(
    tokenEmailRequestDto: TokenEmailResquestDto,
  ): Promise<{ success: true }> {
    const { emailToken } = tokenEmailRequestDto;

    const user = await this.prismaService.user.findFirst({
      where: { emailToken },
    });

    if (!user) {
      throw new SystemException('INVALID_EMAIL_TOKEN');
    }

    await this.prismaService.user.update({
      where: { id: user.id },
      data: { emailConfirmed: true },
    });

    return { success: true };
  }

  async validateToken(token: string): Promise<void> {
    if (!token) {
      throw new SystemException('TOKEN_AUSENTE');
    }

    // Check if token exists in database
    const authToken = await this.prismaService.authToken.findUnique({
      where: { token },
    });

    if (!authToken) {
      throw new SystemException('INVALID_TOKEN');
    }

    // Verify JWT token signature and expiration
    try {
      const payload = await this.jwtService.verifyAsync(token);

      // Verify user still exists
      const user = await this.prismaService.user.findUnique({
        where: { email: payload.email },
      });

      if (!user) {
        throw new SystemException('USER_NOT_FOUND');
      }
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new SystemException('TOKEN_EXPIRED');
      } else if (error.name === 'JsonWebTokenError') {
        throw new SystemException('INVALID_TOKEN');
      } else {
        throw error;
      }
    }
  }
}
