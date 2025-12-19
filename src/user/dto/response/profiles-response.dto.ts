import { ApiProperty } from '@nestjs/swagger';
import { Profile } from '@prisma/client';

export class ProfilesResponseDto {
  @ApiProperty({ description: 'ID', example: Profile.INFLUENCER })
  id: Profile;

  @ApiProperty({ description: 'Nome', example: 'Estudante' })
  name: string;

  @ApiProperty({ description: 'Descrição', example: '' })
  description: string;

  @ApiProperty({
    description: 'Icone',
    example: 'assets/fonts/custom-icon.svg#custom-home',
  })
  icon: string;

  @ApiProperty({ description: 'Ativo', example: true })
  active: boolean;
}
