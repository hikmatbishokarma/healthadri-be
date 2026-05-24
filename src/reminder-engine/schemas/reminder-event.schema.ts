import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReminderEventDocument = ReminderEvent & Document;

export enum ReminderStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  PATIENT_CONFIRMED = 'PATIENT_CONFIRMED',
  CAREGIVER_CONFIRMED = 'CAREGIVER_CONFIRMED',
  SKIPPED = 'SKIPPED',
  MISSED = 'MISSED',
  SNOOZED = 'SNOOZED',
  ESCALATED = 'ESCALATED',
  NAVIGATOR_INTERVENED = 'NAVIGATOR_INTERVENED',
  CANCELLED = 'CANCELLED',
}

export enum ReminderResponse {
  TAKEN = 'TAKEN',
  SKIPPED = 'SKIPPED',
  SNOOZED = 'SNOOZED',
  CAREGIVER_CONFIRMED = 'CAREGIVER_CONFIRMED',
}

export enum SkipReason {
  MED_NOT_NEAR = 'MED_NOT_NEAR',
  FORGOT_BUSY_ASLEEP = 'FORGOT_BUSY_ASLEEP',
  RAN_OUT = 'RAN_OUT',
  DONT_NEED_DOSE = 'DONT_NEED_DOSE',
  SIDE_EFFECTS = 'SIDE_EFFECTS',
  WORRIED_COST = 'WORRIED_COST',
  OTHER = 'OTHER',
}

export enum EscalationLevel {
  NONE = 'NONE',
  CAREGIVER = 'CAREGIVER',
  NAVIGATOR = 'NAVIGATOR',
}

@Schema({ timestamps: true })
export class ReminderEvent {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CarePlanTask', required: true, index: true })
  carePlanTaskId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CarePlanVersion', required: true })
  carePlanVersionId: Types.ObjectId;

  @Prop({ required: true, index: true })
  scheduledAt: Date;

  // When to fire the push notification (scheduledAt minus notifyBeforeMinutes)
  @Prop({ default: null })
  notifyAt: Date | null;

  @Prop({ default: null })
  sentAt: Date | null;

  @Prop({ enum: Object.values(ReminderStatus), default: ReminderStatus.PENDING })
  status: string;

  @Prop({ enum: [...Object.values(ReminderResponse), null], default: null })
  response: string | null;

  @Prop({ enum: [...Object.values(SkipReason), null], default: null })
  skipReason: string | null;

  @Prop({ default: null })
  respondedAt: Date | null;

  @Prop({ default: null })
  snoozedUntil: Date | null;

  @Prop({ enum: Object.values(EscalationLevel), default: EscalationLevel.NONE })
  escalationLevel: string;

  // Task type + title snapshot so we don't need to join on every query
  @Prop({ required: true })
  taskType: string;

  @Prop({ required: true })
  taskTitle: string;
}

export const ReminderEventSchema = SchemaFactory.createForClass(ReminderEvent);

ReminderEventSchema.index({ patientId: 1, scheduledAt: -1 });
ReminderEventSchema.index({ patientId: 1, carePlanTaskId: 1, scheduledAt: 1 }, { unique: true });
ReminderEventSchema.index({ status: 1, scheduledAt: 1 });
ReminderEventSchema.index({ status: 1, notifyAt: 1 });
