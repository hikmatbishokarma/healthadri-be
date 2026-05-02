import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DoctorDocument = Doctor & Document;

@Schema({ timestamps: true })
export class Doctor {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  specialty: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ type: Types.ObjectId, ref: 'Hospital', default: null })
  hospitalId: Types.ObjectId;
}

export const DoctorSchema = SchemaFactory.createForClass(Doctor);
