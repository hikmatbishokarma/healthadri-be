import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InviteCodeDocument = InviteCode & Document;

@Schema({ timestamps: true })
export class InviteCode {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ required: true, enum: ['pending', 'used'], default: 'pending' })
  status: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export const InviteCodeSchema = SchemaFactory.createForClass(InviteCode);
