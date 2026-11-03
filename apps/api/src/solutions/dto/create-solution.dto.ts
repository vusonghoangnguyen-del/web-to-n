import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateSolutionDto {
  @ApiProperty()
  @IsString()
  @Length(20, 10_000)
  content!: string;
}
