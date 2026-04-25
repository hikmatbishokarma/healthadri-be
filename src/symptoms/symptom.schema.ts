import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SymptomDocument = Symptom & Document;

@Schema()
export class Symptom {
  @Prop({ required: true })
  name: string;

  @Prop({ default: 'scale' })
  type: string;

  @Prop({ default: 0 })
  min: number;

  @Prop({ default: 10 })
  max: number;

  @Prop({ required: true })
  threshold: number;
}

export const SymptomSchema = SchemaFactory.createForClass(Symptom);
