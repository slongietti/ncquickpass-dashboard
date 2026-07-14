import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  declarationId!: string;
}
