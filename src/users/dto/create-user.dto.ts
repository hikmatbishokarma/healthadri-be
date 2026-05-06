import {
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid phone number' })
  phone: string;

  @IsEnum(['patient', 'navigator', 'caregiver'])
  role: 'patient' | 'navigator' | 'caregiver';

  @IsOptional()
  @IsMongoId()
  assignedNavigatorId?: string;

  @IsOptional()
  @IsMongoId()
  linkedPatientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  cancerType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  cancerStage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @IsOptional()
  @IsMongoId()
  hospitalId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  chemoSessionsCompleted?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  chemoSessionsTotal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  acuityScore?: number;
}
