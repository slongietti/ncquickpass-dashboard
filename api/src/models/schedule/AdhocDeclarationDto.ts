import { IsISO8601, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Create a one-off ad-hoc future-dated HOV declaration. Because it must be able
 * to run while the user is away, the password is required so the credential vault
 * is (re)armed and the declaration can be created/maintained in the background.
 */
export class AdhocDeclarationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  transponderNumber!: string;

  @IsISO8601()
  startDateTime!: string;

  @IsISO8601()
  endDateTime!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password!: string;
}
