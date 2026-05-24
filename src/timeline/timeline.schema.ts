import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TimelineEventDocument = TimelineEvent & Document;

export enum TimelineEventType {
  VISIT = 'VISIT',
  UPLOAD = 'UPLOAD',
  MEDICATION_STARTED = 'MEDICATION_STARTED',
  MEDICATION_STOPPED = 'MEDICATION_STOPPED',
  DOSAGE_CHANGED = 'DOSAGE_CHANGED',
  CHEMO_CYCLE = 'CHEMO_CYCLE',
  CARE_PLAN_PUBLISHED = 'CARE_PLAN_PUBLISHED',
  REMINDER_SENT = 'REMINDER_SENT',
  REMINDER_MISSED = 'REMINDER_MISSED',
  ESCALATION_TRIGGERED = 'ESCALATION_TRIGGERED',
  ESCALATION_RESOLVED = 'ESCALATION_RESOLVED',
  APPOINTMENT_COMPLETED = 'APPOINTMENT_COMPLETED',
  APPOINTMENT_MISSED = 'APPOINTMENT_MISSED',
  ALERT_CREATED = 'ALERT_CREATED',
  ALERT_RESOLVED = 'ALERT_RESOLVED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
}

export enum ChangeType {
  ADDED = 'ADDED',
  REMOVED = 'REMOVED',
  MODIFIED = 'MODIFIED',
  UNCHANGED = 'UNCHANGED',
}

@Schema({ timestamps: true })
export class TimelineEvent {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(TimelineEventType), index: true })
  eventType: string;

  @Prop({ required: true, index: true })
  eventDate: Date;

  @Prop({ required: true })
  description: string;

  @Prop({ enum: Object.values(ChangeType), default: null })
  changeType: string | null;

  @Prop({ type: Types.ObjectId, default: null })
  relatedEntityId: Types.ObjectId | null;

  @Prop({ default: null })
  relatedEntityType: string | null;

  @Prop({ type: Object, default: null })
  metadata: Record<string, unknown> | null;
}

export const TimelineEventSchema = SchemaFactory.createForClass(TimelineEvent);

TimelineEventSchema.index({ patientId: 1, eventDate: -1 });
