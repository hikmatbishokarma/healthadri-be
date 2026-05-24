import { IsDateString, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishVersionDto {
  @IsMongoId()
  navigatorId: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
