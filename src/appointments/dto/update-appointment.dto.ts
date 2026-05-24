import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { CreateAppointmentDto } from './create-appointment.dto';

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {
  @IsOptional()
  @IsIn([
    'scheduled',
    'due',
    'awaiting_patient_response',
    'awaiting_caregiver_response',
    'navigator_followup_required',
    'completed',
    'missed',
    'cancelled',
    'rescheduled',
  ])
  status?: string;

  @IsOptional()
  @IsIn(['CONFIRMED', 'RESCHEDULED', 'NOT_YET_VISITED'])
  patientResponse?: string;

  @IsOptional()
  @IsDateString()
  patientResponseDeadline?: string;
}
