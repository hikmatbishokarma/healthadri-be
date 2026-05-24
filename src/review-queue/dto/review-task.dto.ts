import { IsObject, IsOptional, IsString, IsMongoId } from 'class-validator';

export class EditTaskDto {
  @IsMongoId()
  navigatorId: string;

  @IsObject()
  edits: Record<string, unknown>;
}

export class VerifyTaskDto {
  @IsMongoId()
  navigatorId: string;
}

export class RejectTaskDto {
  @IsMongoId()
  navigatorId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class PublishBatchDto {
  @IsMongoId()
  navigatorId: string;
}
