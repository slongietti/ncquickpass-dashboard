import { IsISO8601, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Create a one-off ad-hoc future-dated HOV declaration. It is created directly
 * with the caller's session token and never runs in the background, so — unlike
 * an enabled weekly schedule — it needs no password and no credential vault.
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
}
