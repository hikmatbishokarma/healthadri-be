import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AppointmentDocument = Appointment & Document;

@Schema({ timestamps: true })
export class Appointment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({
    enum: ['chemo', 'consultation', 'lab', 'counselling', 'surgery', 'radiation', 'other'],
    default: 'consultation',
  })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  doctor: string;

  @Prop({ default: '' })
  location: string;

  @Prop({ required: true })
  scheduledAt: Date;

  @Prop({
    enum: ['scheduled', 'completed', 'missed', 'cancelled'],
    default: 'scheduled',
  })
  status: string;

  @Prop({ default: '' })
  notes: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdByUserId: Types.ObjectId | null;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
