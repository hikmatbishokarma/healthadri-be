import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(150)
  age?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  gender?: string;

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
  @MaxLength(120)
  hospitalName?: string;

  @IsOptional()
  @IsMongoId()
  hospitalId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  primarySite?: string;

  @IsOptional()
  @IsIn(['newly-diagnosed', 'awaiting-surgery', 'chemo-radiation', 'post-treatment'])
  treatmentStatus?: string;

  @IsOptional()
  @IsDateString()
  dateOfDiagnosis?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'alternatePhone must be a valid phone number' })
  alternatePhone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'caregiverPhone must be a valid phone number' })
  caregiverPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  caregiverRelationship?: string;
}
