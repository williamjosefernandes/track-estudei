import { ApiProperty } from '@nestjs/swagger';
import { SYSTEM_NAME } from '../../../common/constants';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'E-mail do usuário',
    example: SYSTEM_NAME,
  })
  email: string;
}
