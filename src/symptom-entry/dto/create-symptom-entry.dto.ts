import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsMongoId, Min, ValidateNested } from 'class-validator';

export class SymptomResponseDto {
  @IsMongoId()
  symptomId: string;

  @IsInt()
  @Min(0)
  value: number;
}

export class CreateSymptomEntryDto {
  @IsMongoId()
  patientId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SymptomResponseDto)
  responses: SymptomResponseDto[];
}
