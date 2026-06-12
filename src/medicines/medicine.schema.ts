import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MedicineDocument = HydratedDocument<Medicine>;

@Schema({ timestamps: true })
export class Medicine {
  @Prop({ required: true, trim: true, index: true })
  genericName: string;

  @Prop({ trim: true })
  form: string;

  @Prop({ trim: true })
  strengths: string;

  @Prop({ type: [String], default: [] })
  cancerTypes: string[];

  @Prop({ type: [String], default: [] })
  brandNames: string[];

  @Prop({ type: [String], default: [] })
  manufacturers: string[];

  @Prop({ trim: true })
  drugClass: string;

  @Prop({ trim: true, index: true })
  category: string;

  @Prop({ trim: true })
  notes: string;
}

export const MedicineSchema = SchemaFactory.createForClass(Medicine);
