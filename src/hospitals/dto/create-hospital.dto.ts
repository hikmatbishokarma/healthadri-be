import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateHospitalDto {
  // ── Section 1: Identity ────────────────────────────────────────────────────
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  landmark?: string;

  @IsOptional()
  @IsIn(['government', 'private', 'trust'])
  type?: string;

  @IsOptional()
  @IsIn(['Tertiary Care Hospital', 'Daycare Centre', 'Diagnostic Lab'])
  facilityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  hfrId?: string;

  @IsOptional()
  @IsBoolean()
  hfrVerified?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accreditations?: string[];

  // ── Section 2: Oncology Infrastructure ────────────────────────────────────
  @IsOptional()
  @IsBoolean()
  hasDedicatedOncologyWing?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  chemoBedsCount?: number;

  @IsOptional()
  @IsBoolean()
  coldCapTherapy?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  radiotherapy?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  diagnostics?: string[];

  // ── Section 3: Clinical Specializations ───────────────────────────────────
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dmgs?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportiveCare?: string[];

  // ── Section 4: Location & Logistics ───────────────────────────────────────
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emergencyServices?: string[];

  // ── Section 5: Contact ─────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(20)
  opdContact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyContact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsappContact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  patientNavigatorName?: string;

  // ── Section 6: Financials ──────────────────────────────────────────────────
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  govtSchemes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  privateInsurance?: string[];

  // ── Legacy ─────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  acceptsAarogyasri?: boolean;

  @IsOptional()
  @IsBoolean()
  offersPalliative?: boolean;
}
