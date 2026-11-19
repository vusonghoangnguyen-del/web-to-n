import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LatexCompiler } from '../../database/entities/latex-project.entity';

export class CreateLatexProjectDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ enum: LatexCompiler })
  @IsOptional()
  @IsEnum(LatexCompiler)
  compiler?: LatexCompiler;

  @ApiPropertyOptional({ description: 'Nội dung main.tex, tối đa một triệu ký tự' })
  @IsOptional()
  @IsString()
  @MaxLength(1_000_000)
  source?: string;
}
