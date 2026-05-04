import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HospitalDocument = Hospital & Document;

@Schema({ timestamps: true })
export class Hospital {
  // ── Section 1: Identity ────────────────────────────────────────────────────
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  city: string;

  @Prop({ default: '' })
  address: string;

  @Prop({ default: '' })
  landmark: string;

  @Prop({ enum: ['government', 'private', 'trust'], default: 'private' })
  type: string;

  @Prop({
    enum: ['Tertiary Care Hospital', 'Daycare Centre', 'Diagnostic Lab'],
    default: 'Tertiary Care Hospital',
  })
  facilityType: string;

  @Prop({ default: '' })
  hfrId: string;

  @Prop({ default: false })
  hfrVerified: boolean;

  @Prop({ type: [String], default: [] })
  accreditations: string[]; // NABH | JCI | NCG Member

  // ── Section 2: Oncology Infrastructure ────────────────────────────────────
  @Prop({ default: false })
  hasDedicatedOncologyWing: boolean;

  @Prop({ default: 0 })
  chemoBedsCount: number;

  @Prop({ default: false })
  coldCapTherapy: boolean;

  @Prop({ type: [String], default: [] })
  radiotherapy: string[]; // LINAC | Brachytherapy | CyberKnife / Gamma Knife

  @Prop({ type: [String], default: [] })
  diagnostics: string[]; // PET-CT Scan | 3T MRI | IHC Lab | Digital Mammography

  // ── Section 3: Clinical Specializations ───────────────────────────────────
  @Prop({ type: [String], default: [] })
  dmgs: string[]; // Hematology | Solid Tumors | Pediatric Oncology | BMT Unit

  @Prop({ type: [String], default: [] })
  supportiveCare: string[]; // Onco-Nutritionist | Pain & Palliative | Oncology Nursing

  // ── Section 4: Location & Logistics ───────────────────────────────────────
  @Prop({ type: Number, default: null })
  latitude: number | null;

  @Prop({ type: Number, default: null })
  longitude: number | null;

  @Prop({ type: [String], default: [] })
  emergencyServices: string[]; // 24/7 Oncology ER | Dedicated Oncology Ambulance

  // ── Section 5: Contact ─────────────────────────────────────────────────────
  @Prop({ default: '' })
  opdContact: string;

  @Prop({ default: '' })
  emergencyContact: string;

  @Prop({ default: '' })
  whatsappContact: string;

  @Prop({ default: '' })
  patientNavigatorName: string;

  // ── Section 6: Financials ──────────────────────────────────────────────────
  @Prop({ type: [String], default: [] })
  govtSchemes: string[]; // PM-JAY | Aarogyasri | CGHS | ECHS

  @Prop({ type: [String], default: [] })
  privateInsurance: string[];

  // ── Legacy fields (kept for backward compat) ───────────────────────────────
  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: false })
  acceptsAarogyasri: boolean;

  @Prop({ default: false })
  offersPalliative: boolean;
}

export const HospitalSchema = SchemaFactory.createForClass(Hospital);
