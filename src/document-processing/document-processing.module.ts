import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentProcessingController } from './document.controller';
import { DocumentProcessingService } from './document.service';
import { AiAuditLog, AiAuditLogSchema } from './schemas/ai-audit-log.schema';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiAuditLog.name, schema: AiAuditLogSchema },
    ]),
    TasksModule,
  ],
  controllers: [DocumentProcessingController],
  providers: [DocumentProcessingService],
  exports: [DocumentProcessingService],
})
export class DocumentProcessingModule {}
