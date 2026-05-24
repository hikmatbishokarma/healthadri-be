import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AiExtractedTaskDocument = AiExtractedTask & Document;

export enum ExtractedTaskType {
  MEDICATION = 'MEDICATION',
  LAB_TEST = 'LAB_TEST',
  APPOINTMENT = 'APPOINTMENT',
  PROCEDURE = 'PROCEDURE',
}

export enum ReviewStatus {
  AI_GENERATED = 'AI_GENERATED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  EDITED = 'EDITED',
  REJECTED = 'REJECTED',
}

@Schema({ timestamps: true })
export class AiExtractedTask {
  @Prop({ type: Types.ObjectId, ref: 'ReviewBatch', required: true, index: true })
  reviewBatchId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'DocumentMeta', required: true })
  documentId: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(ExtractedTaskType) })
  taskType: string;

  @Prop({ required: true, min: 0, max: 1 })
  confidence: number;

  @Prop({ default: '' })
  sourceText: string;

  @Prop({ enum: Object.values(ReviewStatus), default: ReviewStatus.AI_GENERATED })
  reviewStatus: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reviewedBy: Types.ObjectId | null;

  @Prop({ default: null })
  reviewedAt: Date | null;

  // Typed extracted data — shape depends on taskType
  // MEDICATION: medicineName, dosage, frequency, timing, duration, startDate?
  // LAB_TEST: testName, labName?, scheduledDate?
  // APPOINTMENT: doctorName?, specialty?, scheduledDate?, location?
  // PROCEDURE: procedureName, scheduledDate?, location?
  @Prop({ type: Object, required: true })
  extractedData: Record<string, unknown>;

  @Prop({ type: Object, default: null })
  navigatorEdits: Record<string, unknown> | null;
}

export const AiExtractedTaskSchema = SchemaFactory.createForClass(AiExtractedTask);
