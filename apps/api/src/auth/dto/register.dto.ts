import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) => String(value).trim().replace(/\s+/g, ' '))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsString()
  passwordConfirmation!: string;

  @IsBoolean()
  @Equals(true)
  acceptTerms!: boolean;
}
