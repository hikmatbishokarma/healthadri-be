import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CarePlanVersionDocument = CarePlanVersion & Document;

export enum CarePlanVersionStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
  ARCHIVED = 'ARCHIVED',
}

export interface VersionDiffEntry {
  title: string;
  changeType: 'ADDED' | 'CHANGED' | 'REMOVED';
  previousValue?: string;
  currentValue?: string;
}

@Schema({ timestamps: true })
export class CarePlanVersion {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  versionNumber: number;

  @Prop({ type: Types.ObjectId, ref: 'CarePlanVersion', default: null })
  previousVersionId: Types.ObjectId | null;

  @Prop({ enum: Object.values(CarePlanVersionStatus), default: CarePlanVersionStatus.DRAFT })
  status: string;

  @Prop({ default: null })
  publishedAt: Date | null;

  @Prop({ default: null })
  effectiveFrom: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  publishedById: Types.ObjectId | null;

  @Prop({ default: '' })
  notes: string;

  @Prop({ type: Types.ObjectId, ref: 'ReviewBatch', default: null })
  sourceBatchId: Types.ObjectId | null;

  @Prop({ default: null })
  nextReviewDate: Date | null;

  @Prop({ default: false })
  visibleToPatient: boolean;

  @Prop({
    type: [
      {
        title: String,
        changeType: { type: String, enum: ['ADDED', 'CHANGED', 'REMOVED'] },
        previousValue: String,
        currentValue: String,
      },
    ],
    default: null,
  })
  versionDiff: VersionDiffEntry[] | null;
}

export const CarePlanVersionSchema = SchemaFactory.createForClass(CarePlanVersion);

CarePlanVersionSchema.index({ patientId: 1, versionNumber: -1 });
CarePlanVersionSchema.index({ patientId: 1, status: 1 });
