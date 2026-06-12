import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMedicineDto {
  @IsString()
  @MinLength(2)
  genericName: string;

  @IsOptional()
  @IsString()
  form?: string;

  @IsOptional()
  @IsString()
  strengths?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cancerTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brandNames?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  manufacturers?: string[];

  @IsOptional()
  @IsString()
  drugClass?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
