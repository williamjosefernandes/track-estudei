import { ApiProperty } from '@nestjs/swagger';
import { Profile, Status, Gender } from '@prisma/client';

export class UpdateUserRequestDto {
  @ApiProperty({ description: 'Primeiro Nome', example: 'John' })
  firstName: string;

  @ApiProperty({ description: 'Sobrenome', example: 'Doe' })
  lastName: string;

  @ApiProperty({
    description: 'Email do Usuário',
    example: 'johndoe@example.com',
  })
  email: string;

  @ApiProperty({ description: 'Telefone', example: '(00) 0.0000-0000' })
  phone: string;

  @ApiProperty({ description: 'Gênero', example: Gender.MALE })
  gender: Gender;

  @ApiProperty({
    description: 'Data de Nascimento',
    example: new Date('1991-02-13'),
  })
  birthDate: Date;

  @ApiProperty({ description: 'Perfil do Usuário', example: 'TEACHER' })
  profile: Profile;

  @ApiProperty({ description: 'Status do Usuário', example: 'ACTIVE' })
  status: Status;
}
