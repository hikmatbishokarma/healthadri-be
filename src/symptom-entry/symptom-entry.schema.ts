import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export class SymptomResponse {
  @Prop({ type: Types.ObjectId, ref: 'Symptom' })
  symptomId: Types.ObjectId;

  @Prop()
  name: string;

  @Prop()
  value: number;
}

export type SymptomEntryDocument = SymptomEntry & Document;

@Schema({ timestamps: true })
export class SymptomEntry {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: [{ symptomId: Types.ObjectId, name: String, value: Number }] })
  responses: SymptomResponse[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const SymptomEntrySchema = SchemaFactory.createForClass(SymptomEntry);
