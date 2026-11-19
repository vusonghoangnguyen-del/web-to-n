import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LatexCompiler } from '../../database/entities/latex-project.entity';

export class UpdateLatexProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ enum: LatexCompiler })
  @IsOptional()
  @IsEnum(LatexCompiler)
  compiler?: LatexCompiler;
}
