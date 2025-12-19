import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordResponseDto {
  @ApiProperty({ description: 'Senha alterada com sucesso' })
  success: boolean;
}
