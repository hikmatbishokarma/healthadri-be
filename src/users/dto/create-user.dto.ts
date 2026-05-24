import {
  IsArray,
  IsEmail,
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

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(100)
  caregiverName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  abhaNumber?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'emergencyContactPhone must be a valid phone number' })
  emergencyContactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  primarySite?: string;

  @IsOptional()
  @IsString()
  treatmentStatus?: string;

  @IsOptional()
  @IsString()
  dateOfDiagnosis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  caregiverPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  caregiverRelationship?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  gender?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number;

  @IsOptional()
  @IsString()
  hospitalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  doctorName?: string;

  @IsOptional()
  @IsMongoId()
  doctorId?: string;
}
