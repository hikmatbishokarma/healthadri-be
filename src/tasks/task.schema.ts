import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TaskDocument = Task & Document;

@Schema({ timestamps: true })
export class Task {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({ required: true, enum: ['visit', 'test'] })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ default: 'draft', enum: ['draft', 'active'] })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'DocumentMeta', default: null, index: true })
  sourceDocumentId: Types.ObjectId | null;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
