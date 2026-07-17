import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

/** Cancel the scheduled declarations that conflict with an ad-hoc activation. */
export class ResolveConflictDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
