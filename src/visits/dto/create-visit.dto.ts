import {
  IsDateString,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVisitDto {
  @IsMongoId()
  patientId: string;

  @IsDateString()
  visitDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  doctorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  hospitalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  specialty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  treatmentPhase?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  chemoCycle?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsMongoId()
  appointmentId?: string;
}
