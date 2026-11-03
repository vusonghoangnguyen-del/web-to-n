import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { ProblemDifficulty, ProblemStatus } from '../../database/entities/problem.entity';

export class CreateProblemDto {
  @ApiProperty()
  @IsString()
  @Length(5, 255)
  title!: string;

  @ApiProperty()
  @IsString()
  @Length(10, 30_000)
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  source?: string;

  @ApiPropertyOptional({ enum: ProblemDifficulty, default: ProblemDifficulty.Medium })
  @IsOptional()
  @IsEnum(ProblemDifficulty)
  difficulty: ProblemDifficulty = ProblemDifficulty.Medium;

  @ApiProperty({ type: [String], minItems: 1, maxItems: 5 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  categorySlugs!: string[];

  @ApiPropertyOptional({ enum: [ProblemStatus.Draft, ProblemStatus.Pending], default: ProblemStatus.Pending })
  @IsOptional()
  @IsIn([ProblemStatus.Draft, ProblemStatus.Pending])
  status: ProblemStatus = ProblemStatus.Pending;
}
