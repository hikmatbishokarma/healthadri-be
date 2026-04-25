import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AlertDocument = Alert & Document;

@Schema({ timestamps: true })
export class Alert {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  navigatorId: Types.ObjectId | null;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true, enum: ['HIGH', 'MED', 'LOW'] })
  severity: string;

  @Prop({ required: true })
  reason: string;

  @Prop({ default: 'pending', enum: ['pending', 'resolved'] })
  status: string;
}

export const AlertSchema = SchemaFactory.createForClass(Alert);
