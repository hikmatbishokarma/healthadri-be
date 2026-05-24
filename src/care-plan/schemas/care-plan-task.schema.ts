import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CarePlanTaskDocument = CarePlanTask & Document;

export enum CarePlanTaskType {
  MEDICATION = 'MEDICATION',
  LAB_TEST = 'LAB_TEST',
  APPOINTMENT = 'APPOINTMENT',
  PROCEDURE = 'PROCEDURE',
  VISIT = 'VISIT',
}

export enum CarePlanTaskStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  REPLACED = 'REPLACED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum CarePlanTaskSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Schema({ timestamps: true })
export class CarePlanTask {
  @Prop({ type: Types.ObjectId, ref: 'CarePlanVersion', required: true, index: true })
  carePlanVersionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CarePlanTask', default: null })
  previousTaskId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'AiExtractedTask', default: null })
  sourceExtractedTaskId: Types.ObjectId | null;

  @Prop({ required: true, enum: Object.values(CarePlanTaskType) })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop({ enum: Object.values(CarePlanTaskSeverity), default: CarePlanTaskSeverity.MEDIUM })
  severity: string;

  @Prop({ default: null })
  startDate: Date | null;

  @Prop({ default: null })
  endDate: Date | null;

  @Prop({ enum: Object.values(CarePlanTaskStatus), default: CarePlanTaskStatus.ACTIVE })
  status: string;

  @Prop({ default: '' })
  instructions: string;

  // Holds all typed fields for the task (medicineName, dosage, testName, etc.)
  @Prop({ type: Object, default: {} })
  taskData: Record<string, unknown>;

  // Schedule for reminder engine: { times: ['09:00','21:00'], intervalDays?: 1, notifyBeforeMinutes?: 15 }
  @Prop({ type: Object, default: null })
  schedule: Record<string, unknown> | null;
}

export const CarePlanTaskSchema = SchemaFactory.createForClass(CarePlanTask);

CarePlanTaskSchema.index({ carePlanVersionId: 1, status: 1 });
CarePlanTaskSchema.index({ patientId: 1, status: 1 });
