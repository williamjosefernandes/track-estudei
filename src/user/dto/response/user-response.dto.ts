import { Profile, Status } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: 'Identificador do Usuário', example: '1a2b3c4d' })
  id: string;

  @ApiProperty({ description: 'Avatar', example: '' })
  avatar?: string;

  @ApiProperty({ description: 'Nome', example: 'John' })
  firstName: string;

  @ApiProperty({ description: 'Sobrenome', example: 'John' })
  lastName: string;

  @ApiProperty({
    description: 'Email do Usuário',
    example: 'johndoe@example.com',
  })
  email: string;

  @ApiProperty({ description: 'Perfil do Usuário', example: 'TEACHER' })
  profile: Profile;

  @ApiProperty({ description: 'Status do Usuário', example: 'ACTIVE' })
  status: Status;
}
