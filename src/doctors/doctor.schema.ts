import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DoctorDocument = Doctor & Document;

// Embedded affiliation subdocument
class Affiliation {
  @Prop({ type: Types.ObjectId, ref: 'Hospital', default: null })
  hospitalId: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  consultationDays: string[];

  @Prop({ default: '' })
  consultationHoursStart: string;

  @Prop({ default: '' })
  consultationHoursEnd: string;

  @Prop({ default: '' })
  appointmentNumber: string;
}

@Schema({ timestamps: true })
export class Doctor {
  // ── Section 1: Digital Identity ────────────────────────────────────────────
  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  hprId: string;

  @Prop({ default: '' })
  registrationNumber: string;

  @Prop({ default: '' })
  stateMedicalCouncil: string;

  @Prop({ default: false })
  hprVerified: boolean;

  // ── Section 2: Clinical Expertise ──────────────────────────────────────────
  @Prop({ default: '' })
  primarySpecialty: string;

  @Prop({ type: [String], default: [] })
  dmgs: string[];

  @Prop({ default: 0 })
  yearsOfExperience: number;

  @Prop({ type: [String], default: [] })
  keyProcedures: string[];

  // ── Section 3: Hospital Affiliations ───────────────────────────────────────
  @Prop({ type: [Object], default: [] })
  affiliations: Affiliation[];

  // ── Section 4: Patient Support ─────────────────────────────────────────────
  @Prop({ default: false })
  teleConsultation: boolean;

  @Prop({ type: [String], default: [] })
  insuranceAccepted: string[];

  // ── Section 5: Consent ─────────────────────────────────────────────────────
  @Prop({ default: false })
  dataConsent: boolean;

  // ── Legacy fields ──────────────────────────────────────────────────────────
  @Prop({ default: '' })
  specialty: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ type: Types.ObjectId, ref: 'Hospital', default: null })
  hospitalId: Types.ObjectId;
}

export const DoctorSchema = SchemaFactory.createForClass(Doctor);
