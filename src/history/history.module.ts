import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';

@Module({
  controllers: [HistoryController],
  providers: [HistoryService, PrismaService],
  exports: [HistoryService],
})
export class HistoryModule {}