import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty()
  @IsString()
  @Length(2, 2_000)
  content!: string;
}
