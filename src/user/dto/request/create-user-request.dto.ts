import { ApiProperty } from '@nestjs/swagger';
import { Profile, Gender } from '@prisma/client';

export class CreateUserRequestDto {
  @ApiProperty({
    description: 'E-mail',
    example: 'user@example.com',
    required: true,
  })
  email: string;

  @ApiProperty({
    description: 'Nome',
    example: 'John',
    minLength: 2,
    required: true,
  })
  firstName: string;

  @ApiProperty({
    description: 'Sobrenome',
    example: 'John',
    minLength: 2,
    required: true,
  })
  lastName: string;

  @ApiProperty({
    description: 'Telefone',
    example: '(00) 0.0000-0000',
    required: true,
  })
  phone: string;

  @ApiProperty({ description: 'Gênero', example: Gender.MALE, required: true })
  gender: Gender;

  @ApiProperty({
    description: 'Data de Nascimento',
    example: new Date('1991-02-13'),
    required: true,
  })
  birthDate: Date;

  @ApiProperty({
    description: 'Perfil do Usuário',
    example: Profile.INFLUENCER,
    required: true,
  })
  profile: Profile;

  @ApiProperty({
    description: 'Senha do Usuário',
    example: 'password123',
    minLength: 6,
    required: true,
  })
  password: string;
}
