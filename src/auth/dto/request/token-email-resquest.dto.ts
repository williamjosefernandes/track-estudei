import { ApiProperty } from '@nestjs/swagger';

export class TokenEmailResquestDto {
  @ApiProperty({
    description: 'Token de confirmação de e-mail',
    example: 'jwt-token-email',
  })
  emailToken: string;
}
