import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';

@Injectable()
export class StudentAuthGuard extends AuthGuard {
  constructor(jwtService: JwtService) {
    super(jwtService, 'STUDENT', false);
  }
}
