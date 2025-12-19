import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationUtilsService } from '../common/utils/validation-utils.service';
import { BcryptService } from '../common/services/bcrypt.service';
import { DateApiService } from 'src/common/services/date-api.service';
import { EmailService } from 'src/email/email.service';
import { UtilsModule } from '../common/utils/utils.module';
import { AuthService } from '../auth/auth.service';

@Module({
  controllers: [UserController],
  exports: [ValidationUtilsService],
  providers: [
    UserService,
    PrismaService,
    ValidationUtilsService,
    BcryptService,
    DateApiService,
    EmailService,
    AuthService,
  ],
  imports: [UtilsModule],
})
export class UserModule {}
