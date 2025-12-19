import { ApiProperty } from '@nestjs/swagger';
import { SYSTEM_NAME } from '../../../common/constants';

export class ChangePasswordResponseDto {
  @ApiProperty({ description: 'Senha alterada com sucesso' })
  success: boolean;

  @ApiProperty({
    description: 'E-mail do usuário',
    example: SYSTEM_NAME,
  })
  email?: string;
}
