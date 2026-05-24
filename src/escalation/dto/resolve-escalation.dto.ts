import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveEscalationDto {
  @IsMongoId()
  resolvedById: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
