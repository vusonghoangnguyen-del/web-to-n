import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty()
  @IsString()
  @Length(2, 2_000)
  content!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d*$/)
  parentId?: string;
}
