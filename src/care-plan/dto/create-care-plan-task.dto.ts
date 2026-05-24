import {
  IsDateString,
  IsIn,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCarePlanTaskDto {
  @IsIn(['MEDICATION', 'LAB_TEST', 'APPOINTMENT', 'PROCEDURE', 'VISIT'])
  type: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;

  @IsOptional()
  @IsObject()
  taskData?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  schedule?: Record<string, unknown>;

  @IsOptional()
  @IsMongoId()
  sourceExtractedTaskId?: string;

  @IsOptional()
  @IsMongoId()
  previousTaskId?: string;
}
