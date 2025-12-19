import { Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { JwtModule } from './auth/jwt.module';
import { PrismaService } from './prisma/prisma.service';
import { UserModule } from './user/user.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DateApiService } from './common/services/date-api.service';
import { AuditModule } from './audit/audit.module';
import { CacheModule } from '@nestjs/cache-manager';
import { UtilsModule } from './common/utils/utils.module';
import { HistoryModule } from './history/history.module';

import { HelpDeskModule } from './helpdesk/helpdesk.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'dist', 'templates'),
      serveRoot: '/static',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'assets-data'),
      serveRoot: '/assets-data',
    }),
    CacheModule.register({ isGlobal: true }),
    ScheduleModule.forRoot(),
    UserModule,
    AuthModule,
    JwtModule,
    AuditModule,
    UtilsModule,
    HistoryModule,

    HelpDeskModule,
    NotificationsModule,
    MetricsModule,
  ],
  providers: [PrismaService, DateApiService],
})
export class AppModule implements NestModule {
  configure() {}
}
