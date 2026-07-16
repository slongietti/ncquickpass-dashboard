import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Cancel one materialized (scheduled) declaration by its row id. */
export class CancelMaterializedDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id!: string;
}
