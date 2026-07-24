import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

/** Payload to file a dispute for a set of transactions. */
export class CreateDisputeDto {
  /** Selected dispute reason id (from GET /api/toll-exceptions/reasons). */
  @IsInt()
  reasonId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  comments!: string;

  /** The ledger ids of the transactions to dispute. */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  detailTransactionIds!: string[];
}
