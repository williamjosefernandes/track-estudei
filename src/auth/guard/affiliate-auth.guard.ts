import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';

@Injectable()
export class AffiliateAuthGuard extends AuthGuard {
  constructor(jwtService: JwtService) {
    super(jwtService, 'AFFILIATE', false);
  }
}
