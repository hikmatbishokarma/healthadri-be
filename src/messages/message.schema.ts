import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ required: true, enum: ['patient', 'caregiver', 'navigator', 'bot'] })
  senderType: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  senderId: Types.ObjectId | null;

  @Prop({ required: true })
  body: string;

  @Prop({ default: false })
  readByNavigator: boolean;

  // Populated at write time: which roles can see this message
  @Prop({ type: [String], default: [] })
  visibleTo: string[];

  // Populated by mongoose { timestamps: true } — declared here for TypeScript
  createdAt: Date;
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
