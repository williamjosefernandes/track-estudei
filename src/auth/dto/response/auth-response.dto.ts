import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../../user/dto/response/user-response.dto';

export class AuthResponseDto {
  user: UserResponseDto;

  @ApiProperty({ description: 'Token de acesso', example: 'TOKEN' })
  accessToken: string;

  @ApiProperty({ description: 'Tempo de Expiração', example: '' })
  expiresIn: number;

  constructor(user: UserResponseDto, accessToken: string, expiresIn: number) {
    this.user = user;
    this.accessToken = accessToken;
    this.expiresIn = expiresIn;
  }
}
