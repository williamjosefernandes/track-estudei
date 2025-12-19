import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';

@Injectable()
export class TeacherAuthGuard extends AuthGuard {
  constructor(jwtService: JwtService) {
    super(jwtService, 'TEACHER', false);
  }
}
