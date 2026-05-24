import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EscalationEventDocument = EscalationEvent & Document;

export enum EscalationTrigger {
  MISSED_REMINDERS = 'MISSED_REMINDERS',
  CRITICAL_MEDICATION_MISSED = 'CRITICAL_MEDICATION_MISSED',
  MISSED_APPOINTMENT = 'MISSED_APPOINTMENT',
  HIGH_ALERT = 'HIGH_ALERT',
  MANUAL = 'MANUAL',
}

export enum EscalationLevel {
  CAREGIVER = 'CAREGIVER',
  NAVIGATOR = 'NAVIGATOR',
}

export enum EscalationStatus {
  OPEN = 'OPEN',
  ESCALATED_TO_NAVIGATOR = 'ESCALATED_TO_NAVIGATOR',
  RESOLVED = 'RESOLVED',
}

@Schema({ timestamps: true })
export class EscalationEvent {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  navigatorId: Types.ObjectId;

  @Prop({ enum: Object.values(EscalationTrigger), required: true })
  trigger: string;

  @Prop({ type: Types.ObjectId, default: null })
  triggerEntityId: Types.ObjectId | null;

  @Prop({ default: null })
  triggerEntityType: string | null;

  @Prop({ enum: Object.values(EscalationLevel), default: EscalationLevel.CAREGIVER })
  level: string;

  @Prop({ enum: Object.values(EscalationStatus), default: EscalationStatus.OPEN })
  status: string;

  @Prop({ default: null })
  caregiverNotifiedAt: Date | null;

  @Prop({ default: null })
  navigatorNotifiedAt: Date | null;

  @Prop({ default: null })
  resolvedAt: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  resolvedById: Types.ObjectId | null;

  @Prop({ default: '' })
  resolutionNote: string;

  @Prop({ default: 0 })
  missedCount: number;
}

export const EscalationEventSchema = SchemaFactory.createForClass(EscalationEvent);

EscalationEventSchema.index({ patientId: 1, status: 1 });
EscalationEventSchema.index({ navigatorId: 1, status: 1 });
EscalationEventSchema.index({ status: 1, level: 1, createdAt: 1 });
