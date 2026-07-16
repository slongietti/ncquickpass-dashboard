import { IsISO8601, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** An ad-hoc HOV window to check against the vehicle's scheduled declarations. */
export class ConflictCheckDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  transponderNumber!: string;

  @IsISO8601()
  startDateTime!: string;

  @IsISO8601()
  endDateTime!: string;
}
