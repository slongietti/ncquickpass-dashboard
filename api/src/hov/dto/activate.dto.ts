import { IsISO8601, IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ActivateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  transponderNumber!: string;

  /**
   * Custom HOV end date/time (ISO-8601). When present, the declaration is
   * created as a "DateInTheFuture" range from now until this time. When absent,
   * it falls back to "RestOfToday".
   */
  @IsOptional()
  @IsISO8601()
  endDateTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  location?: string;
}
