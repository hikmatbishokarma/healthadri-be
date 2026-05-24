import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReviewBatchDocument = ReviewBatch & Document;

export enum ReviewBatchStatus {
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  REVIEWED = 'REVIEWED',
  PUBLISHED = 'PUBLISHED',
}

@Schema({ timestamps: true })
export class ReviewBatch {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'DocumentMeta', required: true })
  documentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  navigatorId: Types.ObjectId;

  @Prop({ enum: Object.values(ReviewBatchStatus), default: ReviewBatchStatus.PENDING })
  status: string;

  @Prop({ default: 0 })
  taskCount: number;

  @Prop({ default: 0 })
  verifiedCount: number;

  @Prop({ default: 0 })
  rejectedCount: number;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reviewedBy: Types.ObjectId | null;

  @Prop({ default: null })
  reviewedAt: Date | null;

  @Prop({
    type: Object,
    default: { MEDICATION: 0, LAB_TEST: 0, APPOINTMENT: 0, PROCEDURE: 0 },
  })
  taskTypeCounts: { MEDICATION: number; LAB_TEST: number; APPOINTMENT: number; PROCEDURE: number };

  @Prop({ type: [Object], default: [] })
  taskPills: { name: string; taskType: string }[];

  @Prop({ default: false })
  hasLowConfidence: boolean;
}

export const ReviewBatchSchema = SchemaFactory.createForClass(ReviewBatch);
