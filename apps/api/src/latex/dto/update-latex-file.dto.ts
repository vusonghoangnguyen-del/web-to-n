import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateLatexFileDto {
  @ApiProperty({ description: 'Nội dung mã nguồn của main.tex' })
  @IsString()
  @MaxLength(1_000_000)
  content!: string;
}
