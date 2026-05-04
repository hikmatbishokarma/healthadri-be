import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AffiliationDto {
  @IsOptional()
  @IsMongoId()
  hospitalId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  consultationDays?: string[];

  @IsOptional()
  @IsString()
  consultationHoursStart?: string;

  @IsOptional()
  @IsString()
  consultationHoursEnd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  appointmentNumber?: string;
}

export class CreateDoctorDto {
  // ── Section 1: Digital Identity ────────────────────────────────────────────
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  hprId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  stateMedicalCouncil?: string;

  @IsOptional()
  @IsBoolean()
  hprVerified?: boolean;

  // ── Section 2: Clinical Expertise ──────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(80)
  primarySpecialty?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dmgs?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearsOfExperience?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyProcedures?: string[];

  // ── Section 3: Affiliations ────────────────────────────────────────────────
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AffiliationDto)
  affiliations?: AffiliationDto[];

  // ── Section 4: Patient Support ─────────────────────────────────────────────
  @IsOptional()
  @IsBoolean()
  teleConsultation?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  insuranceAccepted?: string[];

  // ── Section 5: Consent ─────────────────────────────────────────────────────
  @IsOptional()
  @IsBoolean()
  dataConsent?: boolean;

  // ── Legacy ─────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(80)
  specialty?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsMongoId()
  hospitalId?: string;
}
