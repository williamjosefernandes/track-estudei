import { ApiProperty } from '@nestjs/swagger';

export class CheckTokenResponseDto {
  @ApiProperty({ description: 'Senha alterada com sucesso' })
  success: boolean;
}
