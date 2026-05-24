import { IsDateString, IsEnum, IsIn, IsOptional } from 'class-validator';
import { SkipReason } from '../schemas/reminder-event.schema';

export class RespondReminderDto {
  @IsIn(['TAKEN', 'SKIPPED', 'SNOOZED', 'CAREGIVER_CONFIRMED'])
  response: string;

  @IsOptional()
  @IsDateString()
  snoozedUntil?: string;

  @IsOptional()
  @IsEnum(SkipReason)
  skipReason?: SkipReason;
}
