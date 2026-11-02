import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9_]+$/, { message: 'Tên đăng nhập chỉ gồm chữ cái, số và dấu gạch dưới.' })
  username!: string;

  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  passwordConfirmation!: string;

  @IsBoolean()
  @Equals(true)
  acceptTerms!: boolean;
}
