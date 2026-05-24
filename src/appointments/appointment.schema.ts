import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AppointmentDocument = Appointment & Document;

@Schema({ timestamps: true })
export class Appointment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({
    enum: ['chemo', 'consultation', 'lab', 'counselling', 'surgery', 'radiation', 'other'],
    default: 'consultation',
  })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  doctor: string;

  @Prop({ default: '' })
  location: string;

  @Prop({ required: true })
  scheduledAt: Date;

  @Prop({
    enum: [
      'scheduled',
      'due',
      'awaiting_patient_response',
      'awaiting_caregiver_response',
      'navigator_followup_required',
      'completed',
      'missed',
      'cancelled',
      'rescheduled',
    ],
    default: 'scheduled',
  })
  status: string;

  @Prop({ default: '' })
  notes: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdByUserId: Types.ObjectId | null;

  @Prop({ enum: ['CONFIRMED', 'RESCHEDULED', 'NOT_YET_VISITED'], default: null })
  patientResponse: string | null;

  @Prop({ default: null })
  patientResponseAt: Date | null;

  @Prop({ default: null })
  patientResponseDeadline: Date | null;

  @Prop({ default: null })
  caregiverNotifiedAt: Date | null;

  @Prop({ default: null })
  navigatorEscalatedAt: Date | null;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
