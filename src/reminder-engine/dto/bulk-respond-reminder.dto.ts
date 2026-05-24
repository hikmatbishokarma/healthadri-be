import { IsDateString, IsEnum, IsIn, IsMongoId, IsOptional } from 'class-validator';
import { SkipReason } from '../schemas/reminder-event.schema';

export class BulkRespondReminderDto {
  @IsMongoId()
  patientId: string;

  // ISO timestamp of the scheduled slot — reminders within ±30 min will be matched
  @IsDateString()
  scheduledAt: string;

  @IsIn(['TAKEN', 'SKIPPED'])
  response: string;

  @IsOptional()
  @IsEnum(SkipReason)
  skipReason?: SkipReason;
}
