import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

export class ResendVerificationDto {
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
