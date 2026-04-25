import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocumentMetaDocument = DocumentMeta & Document;

@Schema({ timestamps: true, collection: 'document_metas' })
export class DocumentMeta {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploadedByUserId: Types.ObjectId;

  @Prop({
    enum: ['prescription', 'lab', 'discharge', 'other'],
    default: 'other',
  })
  category: string;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  fileSize: number;

  @Prop({ type: Types.ObjectId, required: true })
  gridfsId: Types.ObjectId;
}

export const DocumentMetaSchema = SchemaFactory.createForClass(DocumentMeta);
