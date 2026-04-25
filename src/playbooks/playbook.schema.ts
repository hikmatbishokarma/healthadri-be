import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlaybookDocument = Playbook & Document;

@Schema({ timestamps: true })
export class Playbook {
  @Prop({ required: true, unique: true, index: true })
  triggerType: string;

  @Prop({ required: true })
  title: string;

  @Prop({ type: [String], default: [] })
  steps: string[];
}

export const PlaybookSchema = SchemaFactory.createForClass(Playbook);
