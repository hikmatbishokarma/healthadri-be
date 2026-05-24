import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VisitDocument = Visit & Document;

@Schema({ timestamps: true })
export class Visit {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({ required: true })
  visitDate: Date;

  @Prop({ default: '' })
  doctorName: string;

  @Prop({ default: '' })
  hospitalName: string;

  @Prop({ default: '' })
  specialty: string;

  @Prop({ default: '' })
  treatmentPhase: string;

  @Prop({ default: null })
  chemoCycle: number | null;

  @Prop({ default: '' })
  notes: string;

  @Prop({ type: Types.ObjectId, ref: 'Appointment', default: null })
  appointmentId: Types.ObjectId | null;
}

export const VisitSchema = SchemaFactory.createForClass(Visit);
