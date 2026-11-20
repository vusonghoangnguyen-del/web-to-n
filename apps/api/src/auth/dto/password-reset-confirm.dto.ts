import { IsString, MaxLength, MinLength } from 'class-validator';

export class PasswordResetConfirmDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  passwordConfirmation!: string;
}
