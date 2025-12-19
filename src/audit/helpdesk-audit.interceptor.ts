import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { HelpdeskAuditService } from './helpdesk-audit.service';

type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

@Injectable()
export class HelpdeskAuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: HelpdeskAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const start = Date.now();
    const endpoint = request.originalUrl || request.url;
    const method = request.method;
    const params = {
      query: request.query,
      body: request.body,
      params: request.params,
    };
    const requestedAt = new Date();
    const ip = (request.headers['x-forwarded-for'] as string) || request.ip;
    const user = request.user || {};

    return next.handle().pipe(
      tap(async () => {
        const durationMs = Date.now() - start;
        const statusCode = response.statusCode || 200;

        await this.auditService.logRequest({
          endpoint,
          method,
          params,
          requestedAt,
          ip,
          userId: user?.id,
          accessLevel: user?.profile,
          department: undefined,
          statusCode,
          durationMs,
          level: 'INFO',
          action: undefined,
          entity: undefined,
        });
      }),
      catchError(async (err, caught) => {
        const durationMs = Date.now() - start;
        const statusCode = err?.status || response.statusCode || 500;

        await this.auditService.logRequest({
          endpoint,
          method,
          params,
          requestedAt,
          ip,
          userId: user?.id,
          accessLevel: user?.profile,
          department: undefined,
          statusCode,
          durationMs,
          level: 'ERROR',
          action: undefined,
          entity: undefined,
        });
        throw err;
      }),
    );
  }
}