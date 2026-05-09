import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  navigatorId: Types.ObjectId;

  @Prop({ default: 'pending', enum: ['pending', 'active', 'bot_held', 'escalated'] })
  status: string;

  @Prop({ default: null })
  lastMessageAt: Date;

  @Prop({ default: 0 })
  unreadCount: number;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
