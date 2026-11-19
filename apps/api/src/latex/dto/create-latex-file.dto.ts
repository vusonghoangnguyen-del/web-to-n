import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLatexFileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  path!: string;

  @IsString()
  @MaxLength(1_000_000)
  content!: string;
}
