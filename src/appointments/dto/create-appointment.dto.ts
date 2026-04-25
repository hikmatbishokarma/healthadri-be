import {
  IsDateString,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAppointmentDto {
  @IsMongoId()
  patientId: string;

  @IsOptional()
  @IsIn(['chemo', 'consultation', 'lab', 'counselling', 'surgery', 'radiation', 'other'])
  type?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  doctor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsMongoId()
  createdByUserId?: string;
}
