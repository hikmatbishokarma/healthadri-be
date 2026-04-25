import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateSymptomDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  type?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  min?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  max?: number;

  @IsInt()
  @Min(0)
  threshold: number;
}
