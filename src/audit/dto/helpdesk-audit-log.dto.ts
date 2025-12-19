import { ApiProperty } from '@nestjs/swagger';

type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

export class HelpdeskAuditLogDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  endpoint: string;

  @ApiProperty()
  method: string;

  @ApiProperty({ required: false })
  params?: any;

  @ApiProperty()
  requestedAt: Date;

  @ApiProperty({ required: false })
  ip?: string;

  @ApiProperty({ required: false })
  userId?: string;

  @ApiProperty({ required: false })
  accessLevel?: string;

  @ApiProperty({ required: false })
  department?: string;

  @ApiProperty()
  statusCode: number;

  @ApiProperty()
  durationMs: number;

  @ApiProperty({ enum: ['INFO', 'WARNING', 'ERROR'] })
  level: LogLevel;

  @ApiProperty({ required: false })
  action?: string;

  @ApiProperty({ required: false })
  entity?: string;

  @ApiProperty({ required: false })
  before?: any;

  @ApiProperty({ required: false })
  after?: any;

  @ApiProperty()
  createdAt: Date;
}