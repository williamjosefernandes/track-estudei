import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserRequestDto } from './dto/request/create-user-request.dto';
import { UpdateUserRequestDto } from './dto/request/update-user-request.dto';
import { SystemException } from '../common/exceptions/system-exception';
import { PaginationResponse } from '../common/pagination/pagination-response.dto';
import { UserResponseDto } from './dto/response/user-response.dto';
import { DeleteUserResponseDto } from './dto/response/delete-user-response.dto';
import { ValidationUtilsService } from '../common/utils/validation-utils.service';
import { InativeUserResponseDto } from './dto/response/inative-user-response.dto';
import { InativeUserRequestDto } from './dto/request/inative-user-request.dto';
import { BcryptService } from '../common/services/bcrypt.service';
import { EmailService } from 'src/email/email.service';
import { v4 as uuidv4 } from 'uuid';
import { CompleteProfileRequestDto } from './dto/request/complete-profile-request.dto';
import { Prisma, Profile, Status, User } from '@prisma/client';
import { AuthResponseDto } from '../auth/dto/response/auth-response.dto';
import { AuthService } from '../auth/auth.service';
import { AuthRequestDto } from '../auth/dto/request/auth-request.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validationUtilsService: ValidationUtilsService,
    private readonly bcryptService: BcryptService,
    private readonly emailService: EmailService,
    private readonly authService: AuthService,
  ) {}

  async create(
    createUserDto: CreateUserRequestDto,
    origin: string,
  ): Promise<AuthResponseDto> {
    const {
      firstName,
      lastName,
      email,
      profile,
      password,
      phone,
      gender,
      birthDate,
    } = createUserDto;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !profile ||
      !password ||
      !phone ||
      !gender ||
      !birthDate
    ) {
      throw new SystemException('MISSING_REQUIRED_FIELDS');
    }

    if (!this.validationUtilsService.isValidEmail(email)) {
      throw new SystemException('INVALID_EMAIL');
    }

    if (!this.validationUtilsService.isValidProfile(profile)) {
      throw new SystemException('INVALID_PROFILE');
    }

    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      throw new SystemException('EMAIL_CONFLICT');
    }

    const hashedPassword = password
      ? await this.bcryptService.hashPassword(password)
      : null;

    const emailToken = uuidv4();
    const createdUser = await this.prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        gender,
        birthDate,
        password: hashedPassword,
        profile: profile as Profile,
        status: Status.ACTIVE,
        emailConfirmed: false,
        emailToken: emailToken,
      },
      select: {
        id: true,
        avatar: true,
        firstName: true,
        lastName: true,
        email: true,
        profile: true,
        status: true,
      },
    });

    await this.emailService.confirmEmail({
      email: createdUser.email,
      name: `${createdUser.firstName} ${createdUser.lastName}`,
      url: `${origin}/check-mail?emailToken=${emailToken}`,
    });

    const authRequestDto: AuthRequestDto = {
      email: createdUser.email,
      password: password,
      checkme: true,
    };

    return await this.authService.authenticateUser(authRequestDto);
  }

  async findAll(
    pageNumber: number,
    pageSize: number,
    filters: any,
  ): Promise<PaginationResponse<UserResponseDto>> {
    if (
      !Number.isInteger(pageNumber) ||
      pageNumber <= 0 ||
      !Number.isInteger(pageSize) ||
      pageSize <= 0
    ) {
      throw new SystemException('INVALID_PAGINATION_PARAMETERS');
    }

    const { name, email, profile, status } = filters || {};

    const where: Prisma.UserWhereInput = {
      firstName: name ? { contains: name, mode: 'insensitive' } : undefined,
      email: email ? { contains: email, mode: 'insensitive' } : undefined,
      profile: profile ? { equals: Profile[profile] } : undefined,
      status: status ? { equals: Status[status] } : undefined,
    };

    try {
      const [totalCount, users] = await Promise.all([
        this.prisma.user.count({ where }),
        this.prisma.user.findMany({
          where,
          skip: (pageNumber - 1) * pageSize,
          take: pageSize,
          orderBy: { firstName: 'asc' },
        }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      const pagination = {
        totalItems: totalCount,
        pageSize: pageSize,
        pageNumber: pageNumber,
        totalPages: totalPages,
        previousPage: pageNumber > 1 ? pageNumber - 1 : 0,
        nextPage: pageNumber < totalPages ? pageNumber + 1 : 0,
        lastPage: totalPages,
        hasPreviousPage: pageNumber > 1,
        hasNextPage: pageNumber < totalPages,
      };

      const responseUsers: UserResponseDto[] = users.map((user) => ({
        id: user.id,
        avatar: user.avatar,
        status: user.status,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profile: user.profile,
      }));

      return new PaginationResponse(responseUsers, pagination);
    } catch {
      throw new SystemException('DATABASE_ERROR');
    }
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new SystemException('USER_NOT_FOUND');
    }

    return {
      id: user.id,
      avatar: user.avatar,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profile: user.profile,
    };
  }

  async update(
    id: string,
    updateUserDto: UpdateUserRequestDto,
  ): Promise<UserResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: id.toString() },
    });
    if (!existingUser) {
      throw new SystemException('USER_NOT_FOUND');
    }

    if (updateUserDto.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: updateUserDto.email, id: { not: id } },
      });
      if (existingEmail) {
        throw new SystemException('EMAIL_CONFLICT');
      }
    }

    const { profile, ...rest } = updateUserDto;
    const data: Prisma.UserUpdateInput = {
      ...rest,
      updatedAt: new Date(),
      profile: Profile[profile],
    };

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data,
    });

    return {
      id: updatedUser.id,
      avatar: updatedUser.avatar,
      status: updatedUser.status,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      profile: updatedUser.profile,
    };
  }

  async remove(ids: string[]): Promise<DeleteUserResponseDto> {
    if (!ids || ids.length === 0) {
      throw new SystemException('IDS_REQUIRED');
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
        profile: true,
      },
    });

    const usersToDelete = users.filter((user) => user.profile == Profile.ADMIN);
    const deleteIds = usersToDelete.map((user) => user.id);

    if (deleteIds.length === 0) {
      throw new SystemException('CANNOT_DELETE_OWNER_USERS');
    }

    const deleteResult = await this.prisma.user.deleteMany({
      where: {
        id: {
          in: deleteIds,
        },
      },
    });

    if (deleteResult.count === 0) {
      throw new SystemException('USERS_NOT_FOUND');
    }

    return { success: true };
  }

  async deactivateUsers(
    requestDto: InativeUserRequestDto,
  ): Promise<InativeUserResponseDto> {
    try {
      const { ids } = requestDto;

      if (!ids || ids.length === 0) {
        throw new SystemException('IDS_REQUIRED');
      }

      const users = await this.prisma.user.findMany({
        where: { id: { in: ids } },
      });

      const existingUserIds = users.map((user) => user.id);

      await this.prisma.user.updateMany({
        where: { id: { in: existingUserIds }, status: Status.ACTIVE },
        data: { status: Status.INACTIVE },
      });

      const success = existingUserIds.length > 0;

      return { success };
    } catch (error) {
      if (error instanceof SystemException) {
        throw error;
      }
      throw new SystemException('DATABASE_ERROR');
    }
  }

  async updatePassword(
    user: User,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const isPasswordValid = await this.bcryptService.comparePasswords(
      oldPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new SystemException('INVALID_PASSWORD');
    }

    const [isPasswordStrong, message] =
      this.validationUtilsService.isPasswordStrong(newPassword);
    if (!isPasswordStrong) {
      throw new SystemException('WEAK_PASSWORD', message);
    }

    const hashedPassword = await this.bcryptService.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return {
      success: true,
      message: 'Password updated successfully',
    };
  }

  async isEmailRegistered(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return !!user;
  }

  async completeProfile(
    userId: string,
    completeProfileDto: CompleteProfileRequestDto,
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existingUser) {
      throw new SystemException('USER_NOT_FOUND');
    }

    const data: Prisma.UserUpdateInput = {
      updatedAt: new Date(),
      firstName: completeProfileDto.firstName,
      lastName: completeProfileDto.lastName,
      birthDate: completeProfileDto.birthDate,
      phone: completeProfileDto.phone,
    };

    await this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async updateAvatar(userId: string, avatar: string): Promise<UserResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new SystemException('USER_NOT_FOUND');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        avatar,
        updatedAt: new Date(),
      },
    });

    return {
      id: updatedUser.id,
      avatar: updatedUser.avatar,
      status: updatedUser.status,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      profile: updatedUser.profile,
    };
  }

  async getAvatar(userId: string): Promise<{ avatar: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    if (!user) {
      return {
        avatar: null,
      };
    }

    return { avatar: user.avatar };
  }

  profiles() {
    const allProfiles = [
      {
        id: Profile.INFLUENCER,
        name: 'Influencer',
        description: 'Ganhe por campanhas',
        icon: 'assets/fonts/custom-icon.svg#custom-user',
        active: true,
      },
      {
        id: Profile.ADVERTISER,
        name: 'Professor',
        description: 'Crie campanhas',
        icon: 'assets/fonts/custom-icon.svg#custom-user',
        active: false,
      },
    ];

    return allProfiles.filter((profile) => profile.active === true);
  }
}
