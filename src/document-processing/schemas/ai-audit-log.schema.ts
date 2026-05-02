import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AiAuditLogDocument = AiAuditLog & Document;

@Schema({ timestamps: true, collection: 'ai_audit_logs' })
export class AiAuditLog {
  @Prop({ required: true })
  provider: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  patientId: Types.ObjectId;

  @Prop()
  filePath: string;

  @Prop()
  extractedText: string;

  @Prop({ type: Object })
  llmResponse: Record<string, unknown>;

  @Prop()
  rawLlmContent: string;

  @Prop({ type: [Object], default: [] })
  parsedTasks: unknown[];

  @Prop({ default: 'document-processing', index: true })
  feature: string;

  @Prop()
  userMessage: string;

  @Prop()
  classification: string;

  @Prop()
  responseText: string;

  @Prop()
  error: string;
}

export const AiAuditLogSchema = SchemaFactory.createForClass(AiAuditLog);
