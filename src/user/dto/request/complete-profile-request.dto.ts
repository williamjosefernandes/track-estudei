import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { Profile } from '@prisma/client';

export class CompleteProfileRequestDto {
  @ApiProperty({ description: 'Tipo da Conta' })
  @IsString()
  @IsNotEmpty()
  profile: Profile;

  @ApiProperty({ description: 'Nome' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Sobrenome' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    description: 'Documento CPF ou CNPJ do usuário',
    example: '123.456.789-00',
  })
  @IsString()
  @IsNotEmpty()
  cpf: string;

  @ApiProperty({
    description: 'Data de Nascimento',
    example: '13/02/1991',
  })
  @IsString()
  @IsNotEmpty()
  birthDate: string;

  @ApiProperty({ description: 'Número de telefone do usuário' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}
