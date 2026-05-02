import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { DocumentProcessingModule } from '../document-processing/document-processing.module';
import {
  AiAuditLog,
  AiAuditLogSchema,
} from '../document-processing/schemas/ai-audit-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiAuditLog.name, schema: AiAuditLogSchema },
    ]),
    DocumentProcessingModule,
  ],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
