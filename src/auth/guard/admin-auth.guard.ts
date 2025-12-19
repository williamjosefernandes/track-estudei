import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';

@Injectable()
export class AdminAuthGuard extends AuthGuard {
  constructor(jwtService: JwtService) {
    super(jwtService, 'ADMIN', false);
  }
}
