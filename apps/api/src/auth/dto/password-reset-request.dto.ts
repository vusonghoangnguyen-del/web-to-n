import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

export class PasswordResetRequestDto {
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
