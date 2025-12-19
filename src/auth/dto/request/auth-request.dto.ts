import { ApiProperty } from '@nestjs/swagger';

export class AuthRequestDto {
  @ApiProperty({
    description: 'E-mail do usuário',
    example: 'contato@wjfdeveloper.com.br',
  })
  email: string;

  @ApiProperty({
    description: 'Senha do usuário',
    example: 'wjfdeveloper.com.br312r',
  })
  password: string;

  @ApiProperty({
    description: 'Manter conectado',
    example: true,
  })
  checkme: boolean;
}
