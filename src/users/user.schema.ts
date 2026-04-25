import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true, enum: ['patient', 'navigator'] })
  role: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  assignedNavigatorId: Types.ObjectId;

  @Prop({ default: '' })
  cancerType: string;

  @Prop({ default: '' })
  cancerStage: string;

  @Prop({ default: '' })
  avatar: string;

  @Prop({ default: false })
  profileCompleted: boolean;

  @Prop()
  age: number;

  @Prop({ default: '' })
  gender: string;

  @Prop({ default: '' })
  hospitalName: string;

  @Prop({ unique: true, sparse: true })
  patientCode: string;

  @Prop({ type: Types.ObjectId, ref: 'Hospital', default: null })
  hospitalId: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  languages: string[];

  @Prop({ default: 0 })
  chemoSessionsCompleted: number;

  @Prop({ default: 0 })
  chemoSessionsTotal: number;

  @Prop({ default: 0 })
  acuityScore: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
