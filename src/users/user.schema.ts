import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ required: true, enum: ['patient', 'navigator', 'super-admin', 'caregiver'] })
  role: string;

  @Prop({ unique: true, sparse: true, lowercase: true, trim: true })
  email: string;

  @Prop({ default: '' })
  passwordHash: string;

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

  // caregiver accounts only
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  linkedPatientId: Types.ObjectId;

  // patient profile fields
  @Prop({ default: '' })
  primarySite: string;

  @Prop({
    default: '',
    enum: ['', 'newly-diagnosed', 'awaiting-surgery', 'chemo-radiation', 'post-treatment'],
  })
  treatmentStatus: string;

  @Prop({ default: null })
  dateOfDiagnosis: Date;

  @Prop({ default: '' })
  alternatePhone: string;

  // caregiver info captured during patient onboarding (before caregiver registers)
  @Prop({ default: '' })
  caregiverName: string;

  @Prop({ default: '' })
  caregiverPhone: string;

  @Prop({ default: '' })
  caregiverRelationship: string;

  @Prop({ default: '' })
  abhaNumber: string;

  @Prop({ default: '' })
  emergencyContactPhone: string;

  @Prop({ default: '' })
  doctorName: string;

  @Prop({ type: Types.ObjectId, ref: 'Doctor', default: null })
  doctorId: Types.ObjectId;

  @Prop({ default: null })
  lastActiveAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'CarePlanVersion', default: null })
  activeCarePlanVersionId: Types.ObjectId | null;

  @Prop({ type: [String], default: [] })
  pushTokens: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
