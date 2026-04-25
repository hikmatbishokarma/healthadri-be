import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HospitalDocument = Hospital & Document;

@Schema({ timestamps: true })
export class Hospital {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  city: string;

  @Prop({ default: '' })
  address: string;

  @Prop({ enum: ['government', 'private', 'trust'], default: 'private' })
  type: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: false })
  acceptsAarogyasri: boolean;

  @Prop({ default: false })
  offersPalliative: boolean;
}

export const HospitalSchema = SchemaFactory.createForClass(Hospital);
